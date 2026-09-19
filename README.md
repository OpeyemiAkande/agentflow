# AgentFlow

AgentFlow is a visual workflow-automation builder: connect trigger nodes (manual,
Stripe, Google Forms) to action nodes (Anthropic/OpenAI/Gemini calls, HTTP requests,
Discord/Slack messages) on a canvas, save the graph, and run it. A durable background
engine executes the graph node-by-node and streams live status back to the canvas.

See [ARCHITECTURE.md](ARCHITECTURE.md) for a full technical breakdown of the stack, data
model, and execution engine.

## Tech stack

Next.js 16 (App Router) · React 19 · tRPC 11 · Prisma 6 / PostgreSQL · better-auth ·
Polar (billing) · Inngest (durable workflow execution) · `@xyflow/react` (canvas) ·
Vercel AI SDK (Anthropic/OpenAI/Gemini) · Tailwind v4 + shadcn/radix · Sentry · Biome

## Getting started

### Prerequisites

- Node.js and a package manager (npm, as used below)
- A PostgreSQL database

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_KEY` | Key used to encrypt stored credential values |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | better-auth session config |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini node fallback / dev usage |
| `OPENAI_API_KEY` | OpenAI node fallback / dev usage |
| `ANTHROPIC_API_KEY` | Anthropic node fallback / dev usage |
| `POLAR_ACCESS_TOKEN` / `POLAR_SUCCESS_URL` | Polar billing integration |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` / `INNGEST_DEV` | Inngest workflow engine |
| `SENTRY_AUTH_TOKEN` | Sentry source map uploads |

### 3. Set up the database

```bash
npx prisma migrate dev
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To also run the Inngest dev server (required to actually execute workflows locally),
run it alongside the app:

```bash
npm run inngest:dev
```

Or run everything (app, Inngest, ngrok tunnel) together via `mprocs`:

```bash
npm run dev:all
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Lint with Biome |
| `npm run format` | Format with Biome |
| `npm run inngest:dev` | Start the local Inngest dev server |
| `npm run ngrok:dev` | Expose the local server via ngrok (for webhook testing) |
| `npm run dev:all` | Run app + Inngest + ngrok together via `mprocs` |

## Learn more

- [ARCHITECTURE.md](ARCHITECTURE.md) — directory layout, data model, auth, and the
  workflow execution engine
- [Next.js Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Inngest Documentation](https://www.inngest.com/docs)
