export type VisitShareChannel = "sms" | "whatsapp" | "link";

export type VisitShare = {
  id: string;
  clinicId: string;
  visitId: string;
  token: string;
  channel: VisitShareChannel;
  recipientPhone: string | null;
  createdByUserId: string | null;
  twilioMessageSid: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
};

export type CreateVisitShareInput = {
  clinicId: string;
  visitId: string;
  token: string;
  channel: VisitShareChannel;
  recipientPhone: string | null;
  createdByUserId: string | null;
  expiresAt: string | null;
};
