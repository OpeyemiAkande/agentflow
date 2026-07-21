// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://8ec15a49946f8ccb87eccf6e5b379153@o4511142063046656.ingest.de.sentry.io/4511581876977744",
  integrations: [
    Sentry.vercelAIIntegration({
      recordInputs: true,
      recordOutputs: true
    }),
    Sentry.consoleLoggingIntegration({
      levels: ["log", "warn", "error"]
    })
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true
});
