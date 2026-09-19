import { describe, expect, it } from "vitest";
import { Hono } from "hono";

process.env["TWILIO_VALIDATE_SIGNATURE"] = "true";

const { twilioRoutes } = await import("../../../src/server/routes/twilio.js");

function makeApp() {
  const app = new Hono();
  app.route("/", twilioRoutes);
  return app;
}

describe("POST /twilio/status signature validation", () => {
  it("rejects unsigned Twilio status callbacks when signature validation is enabled", async () => {
    const body = new URLSearchParams({
      CallSid: "CA1234567890",
      CallStatus: "completed",
      From: "+972541234567",
    });

    const res = await makeApp().request("/twilio/status", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    expect(res.status).toBe(403);
  });
});
