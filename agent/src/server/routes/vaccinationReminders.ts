import { Hono } from "hono";
import { enqueueDueVaccinationReminders } from "../../lib/vaccinationReminders.js";
import { runProtectedJob } from "./jobs.js";

export const vaccinationReminderRoutes = new Hono();

vaccinationReminderRoutes.post("/send-vaccination-reminders", async (c) => {
  return runProtectedJob(c, "send-vaccination-reminders", async () => {
    return enqueueDueVaccinationReminders();
  });
});
