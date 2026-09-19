import { Hono } from "hono";
import { logger as appLogger } from "../lib/logger.js";
import { healthRoutes } from "./routes/health.js";
import { twilioRoutes } from "./routes/twilio.js";
import { toolsRoutes } from "./routes/tools.js";
import { hooksRoutes } from "./routes/hooks.js";
import { jobsRoutes } from "./routes/jobs.js";
import { vaccinationReminderRoutes } from "./routes/vaccinationReminders.js";

export function createApp(): Hono {
  const app = new Hono();

  // Basic request log (lightweight — full logs come from route handlers).
  app.use("*", async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    appLogger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration_ms: ms,
      },
      "request",
    );
  });

  app.route("/", healthRoutes);
  app.route("/", twilioRoutes);
  app.route("/", toolsRoutes);
  app.route("/", hooksRoutes);
  app.route("/jobs", jobsRoutes);
  app.route("/jobs", vaccinationReminderRoutes);

  // Fallback 404 with structured body.
  app.notFound((c) =>
    c.json({ error: "not_found", path: c.req.path }, 404),
  );

  app.onError((err, c) => {
    appLogger.error({ err, path: c.req.path }, "unhandled error");
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
