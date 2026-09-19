export type CalendarBlock = {
  id: string;
  clinicId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type CalendarBlockListFilters = {
  clinicIds: string[];
  from: string;
  to: string;
};

export type CreateCalendarBlockInput = {
  clinicId: string;
  startAt: string;
  endAt: string;
  reason?: string | null;
};
