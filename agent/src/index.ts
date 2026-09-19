import { serve } from "@hono/node-server";
import { createApp } from "./server/app.js";
import { getEnv } from "./lib/env.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  const env = getEnv();
  const app = createApp();

  const server = serve(
    { fetch: app.fetch, port: env.PORT },
    (info) => {
      logger.info(
        {
          port: info.port,
          env: env.NODE_ENV,
          publicBaseUrl: env.PUBLIC_BASE_URL,
        },
        "voxly-vet/agent started",
      );
    },
  );

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
