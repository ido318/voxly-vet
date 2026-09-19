export type VoiceCallDirection = "inbound" | "outbound";

export type VoiceCallStatus =
  | "queued"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "busy"
  | "no_answer"
  | "canceled";

export type TranscriptItem = {
  role: "user" | "agent";
  message?: string;
  time_in_call_secs?: number;
};

export type VoiceCall = {
  id: string;
  clinicId: string;
  customerId: string | null;
  petId: string | null;
  appointmentId: string | null;
  visitId: string | null;
  direction: VoiceCallDirection;
  status: VoiceCallStatus;
  fromNumber: string;
  toNumber: string;
  twilioCallSid: string | null;
  twilioParentCallSid: string | null;
  elevenLabsConversationId: string | null;
  agentName: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  recordingStoragePath: string | null;
  transcript: TranscriptItem[] | null;
  aiSummary: string | null;
  callCategory: "operation" | "information" | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type VoiceCallListFilters = {
  clinicIds: string[];
  customerId?: string;
  petId?: string;
  appointmentId?: string;
  visitId?: string;
  status?: VoiceCallStatus;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type UpsertInboundVoiceCallInput = {
  clinicId: string;
  customerId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  visitId?: string | null;
  fromNumber: string;
  toNumber: string;
  twilioCallSid: string;
  twilioParentCallSid?: string | null;
  status?: VoiceCallStatus;
  metadata?: Record<string, unknown>;
};

export type LinkVoiceCallInput = {
  customerId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  visitId?: string | null;
};

export type UpdateVoiceCallStatusInput = {
  status: VoiceCallStatus;
  endedAt?: string | null;
  durationSeconds?: number | null;
  recordingUrl?: string | null;
  metadata?: Record<string, unknown>;
};
