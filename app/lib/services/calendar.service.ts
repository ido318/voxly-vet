import { ok, type Result } from "@/lib/errors/app-error";
import {
  CLINIC_TIMEZONE,
  effectiveDuration,
  getClinicHoursForDate,
  toIsraelLocalIso,
  occupiesSlot,
} from "@/lib/appointment-rules";
import type { CalendarBlockRepository } from "@/lib/repositories/calendar-block.repository";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Appointment } from "@/types/domain/appointment";
import type { AppointmentType } from "@/types/domain/appointment";
import type { CalendarAvailabilityResponse } from "@/types/api/appointments";

function dayBounds(date: string): { startIso: string; endIso: string } {
  const start = new Date(toIsraelLocalIso(date, "00:00"));
  const end = new Date(toIsraelLocalIso(date, "23:59"));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function combineDateAndClock(date: string, hhmm: string): Date {
  return new Date(toIsraelLocalIso(date, hhmm));
}

export class CalendarService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly calendarBlockRepository?: CalendarBlockRepository,
  ) {}

  async listDay(
    actor: ServiceActor,
    clinicId: string,
    date: string,
  ): Promise<Result<Appointment[]>> {
    const { startIso, endIso } = dayBounds(date);
    return this.appointmentRepository.list({
      clinicIds: actor.clinicIds.filter((id) => id === clinicId),
      from: startIso,
      to: endIso,
    });
  }

  async listWeek(
    actor: ServiceActor,
    clinicId: string,
    weekStartDate: string,
  ): Promise<Result<Appointment[]>> {
    const from = new Date(toIsraelLocalIso(weekStartDate, "00:00"));
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    return this.appointmentRepository.list({
      clinicIds: actor.clinicIds.filter((id) => id === clinicId),
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  async availabilityByDate(
    actor: ServiceActor,
    clinicId: string,
    date: string,
    timezone = CLINIC_TIMEZONE,
    visitType: AppointmentType = "checkup",
  ): Promise<Result<CalendarAvailabilityResponse>> {
    const workingHours = getClinicHoursForDate(date);
    const slotMinutes = effectiveDuration(visitType);
    if (!workingHours) {
      return ok({
        clinicId,
        date,
        slotMinutes,
        timezone,
        availableSlots: [],
      });
    }

    const openAt = combineDateAndClock(date, workingHours.open);
    const closeAt = combineDateAndClock(date, workingHours.close);

    const clinicIds = actor.clinicIds.filter((id) => id === clinicId);
    const appointmentsResult = await this.appointmentRepository.list({
      clinicIds,
      from: openAt.toISOString(),
      to: closeAt.toISOString(),
      status: undefined,
    });
    if (!appointmentsResult.ok) return appointmentsResult;

    const blocksResult = this.calendarBlockRepository
      ? await this.calendarBlockRepository.list({
          clinicIds,
          from: openAt.toISOString(),
          to: closeAt.toISOString(),
        })
      : { ok: true as const, value: [] };
    if (!blocksResult.ok) return blocksResult;

    // Was a local three-status list that omitted checked_in and in_visit, so a
    // patient already in the room did not block their own slot.
    const active = appointmentsResult.value.filter((row) => occupiesSlot(row.status));

    const slots: string[] = [];
    for (
      let cursor = openAt.getTime();
      cursor + slotMinutes * 60_000 <= closeAt.getTime();
      cursor += 10 * 60_000
    ) {
      const slotStart = cursor;
      const slotEnd = cursor + slotMinutes * 60_000;
      const overlaps = active.some((appointment) => {
        const start = new Date(appointment.scheduledAt).getTime();
        const end = start + appointment.durationMinutes * 60_000;
        return slotStart < end && slotEnd > start;
      }) || blocksResult.value.some((block) => {
        const start = new Date(block.startAt).getTime();
        const end = new Date(block.endAt).getTime();
        return slotStart < end && slotEnd > start;
      });
      if (!overlaps) slots.push(new Date(slotStart).toISOString());
    }

    return ok({
      clinicId,
      date,
      slotMinutes,
      timezone,
      availableSlots: slots,
    });
  }
}
