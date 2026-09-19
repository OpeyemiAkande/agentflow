# agentflow — Technical Overview

agentflow is a visual workflow-automation builder in the style of n8n/Zapier: users build a
directed graph of trigger and action nodes on a canvas, save it, and run it. A durable
background engine executes the graph node-by-node, calling out to AI providers, HTTP
endpoints, and chat webhooks as configured, and streams live status back to the canvas.

## Tech stack

| Layer                             | Choice                                                                  |
| --------------------------------- | ----------------------------------------------------------------------- |
| Framework                         | Next.js 16 (App Router), React 19                                       |
| API layer                         | tRPC 11 (`@trpc/server`, `@trpc/tanstack-react-query`)                  |
| Database                          | PostgreSQL via Prisma 6                                                 |
| Auth                              | better-auth (email/password + GitHub/Google OAuth)                      |
| Billing                           | Polar, via `@polar-sh/better-auth` plugin                               |
| Background jobs / workflow engine | Inngest (durable steps + Realtime channels)                             |
| Canvas / graph UI                 | `@xyflow/react`                                                         |
| AI providers                      | Vercel AI SDK — `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` |
| UI kit                            | Tailwind v4, shadcn/radix primitives                                    |
| Templating                        | Handlebars (node prompt/body/endpoint templating)                       |
| Observability                     | Sentry (client, server, edge)                                           |
| Lint/format                       | Biome                                                                   |

There is currently no test framework configured (no unit, integration, or e2e coverage).

## Directory structure

```
prisma/schema.prisma                  Database schema (source of truth)
src/
  app/
    (auth)/login, (auth)/signup       Public auth pages
    (dashboard)/(editor)/workflows/[workflowId]   Full-screen flow canvas
    (dashboard)/(rest)/{credentials,executions,workflows}   List/detail pages
    api/auth/[...all]                 better-auth route handler
    api/inngest                       Inngest serve endpoint
    api/trpc/[trpc]                   tRPC fetch adapter
    api/webhooks/{google-form,stripe} Public trigger-ingestion endpoints
  features/                           Feature-sliced modules
    auth, credentials, executions, subscriptions, triggers, workflows, editor
    each ~= { components/, hooks/, server/ (trpc router, prefetch, loaders), lib/ }
  components/{react-flow, ui}         xyflow wrapper + shadcn/radix primitives
  config/{constants.ts, node-components.ts}   NodeType -> canvas component registry
  inngest/                            client.ts, functions.ts, utils.ts, channels/*
  lib/                                auth.ts, auth-client.ts, db.ts, encryption.ts, polar.ts
  trpc/                               init.ts, client.tsx, server.tsx, routers/_app.ts
  generated/prisma                    Generated Prisma client (non-default output path)
```

## Data model

Core Prisma models: `User`, `Session`, `Account`, `Verification` (owned by better-auth),
plus the product models `Credential`, `Workflow`, `Node`, `Connection`, `Execution`.

- **Ownership** is per-user, not multi-tenant: `Workflow` and `Credential` both FK to
  `User.id` with cascade delete. There is no organization/team concept.
- **`Workflow`** has many `Node`s and `Connection`s (cascade-deleted with the workflow).
  `Connection` has a unique constraint on `(fromNodeId, toNodeId, fromOutput, toInput)`.
- **`Node`** optionally references a `Credential` and carries a free-form JSON `data` field
  for node-specific configuration (prompts, URLs, etc).
- **`Credential`** stores an encrypted `value` string; `CredentialType` currently covers
  only `OPENAI` / `ANTHROPIC` / `GEMINI`.
- **`Execution`** records one run of a workflow, keyed by a unique `inngestEventId`, with a
  status and an `output` JSON blob (the final shared context).
- No explicit `@@index` directives beyond FK-implied indexes, and no soft deletes.

## Request/auth flow

- `src/lib/auth.ts` configures better-auth with the Prisma adapter, email/password
  (`autoSignIn: true`), GitHub/Google OAuth, and the Polar plugin (auto-creates a Polar
  customer on signup, exposes `checkout()`/`portal()` sub-routes).
- There is no Next.js `middleware.ts` gating dashboard routes — the dashboard layout
  renders unconditionally; access control is enforced entirely at the tRPC procedure
  level.
- `src/trpc/init.ts` defines:
  - `protectedProcedure` — re-derives the session per call via
    `auth.api.getSession({ headers })`, throws `UNAUTHORIZED` if absent.
  - `premiumProcedure` — additionally checks the user's Polar subscription state via
    `polarClient.customers.getStateExternal`, throws `FORBIDDEN` if there's no active
    subscription. Applied to creation endpoints (`workflows.create`,
    `credentials.create`); update/delete/execute only require `protectedProcedure`.
  - Every feature router filters its Prisma queries by `ctx.auth.user.id` directly in the
    `where` clause — ownership is checked at the data-access layer everywhere, not just
    at the router boundary.

## Workflow execution engine

1. **Build**: the editor (`src/features/editor`, backed by `@xyflow/react` and a Jotai
   store) lets the user place nodes and connections on a canvas. Node visual components
   live under each feature's `components/<type>/node.tsx` and are registered centrally in
   `src/config/node-components.ts`.
2. **Save**: `workflows.update` runs inside a Prisma `$transaction` that deletes and
   recreates all of a workflow's nodes/connections from the submitted graph (no
   incremental diffing, no optimistic concurrency check).
3. **Trigger**: a run starts from the manual "Execute" button, or from one of two public
   webhook routes (`api/webhooks/stripe`, `api/webhooks/google-form`), all of which call
   `sendWorkflowExecution()` → `inngest.send({ name: "workflows/execute.workflow", ... })`.
4. **Execute**: a single Inngest function (`src/inngest/functions.ts`) handles every run:
   creates an `Execution` row, loads the graph, topologically sorts nodes (`toposort`;
   throws on cycles), then executes them **sequentially**, threading a shared `context`
   object between nodes. Each node type resolves to an executor via
   `getExecutor(node.type)` (`src/features/executions/lib/executor-registry.ts`).
5. **Observe**: each node type publishes status updates to its own Inngest Realtime
   channel (`src/inngest/channels/*.ts`); the canvas subscribes per-node to show live
   pass/fail/running state.
6. **Finish**: on success, `Execution.status = SUCCESS` with the final context as
   `output`; Inngest's `onFailure` handler marks the run `FAILED` with the error and
   stack trace.

There is currently no branching/conditional node type — execution is a straight
topologically-sorted sequence.

## Node types

- **Triggers**: manual, Stripe webhook, Google Form webhook.
- **Actions**: Anthropic, OpenAI, and Gemini chat-completion nodes (via AI SDK,
  wrapped in `step.ai.wrap` for durable/replayable calls); HTTP Request node; Discord and
  Slack webhook-post nodes.
- Prompts, request bodies, and endpoint URLs are all Handlebars-templated against the
  running execution `context`, so upstream node output (including raw webhook payloads)
  flows directly into downstream templates.
- AI credentials are pulled from the `Credential` table, decrypted (`src/lib/encryption.ts`,
  a `cryptr` wrapper over `ENCRYPTION_KEY`) only at call time, and never persisted in
  plaintext. Discord/Slack webhook URLs, by contrast, are stored as plain JSON on `Node.data`
  rather than through the encrypted `Credential` path.
