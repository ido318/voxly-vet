/** Structured triage context, written by the agent into its own column. */
export interface EscalationContext {
  decision?: string;
  after_hours?: boolean;
  matched_flags?: string[];
  /** The caller's own description, in full — it used to be cut at 120 chars. */
  symptoms_he?: string;
  duration_he?: string | null;
  pet_type?: string;
  source?: string;
  emergency?: boolean;
}

export interface Escalation {
  id: string;
  clinicId: string;
  voiceCallId: string | null;
  elevenLabsConversationId: string | null;
  /** E.164, when the caller id was available. */
  callerPhone: string | null;
  customerId: string | null;
  customerName: string | null;
  petId: string | null;
  petName: string | null;
  reason: string;
  urgency: number;
  context: EscalationContext;
  resolvedAt: string | null;
  resolvedBy: string | null;
  /** The human's note on resolving. Never the agent's context — see context. */
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  afterHours?: boolean;
}

export interface EscalationListFilters {
  clinicIds: string[];
  status?: "open" | "resolved";
  limit?: number;
  offset?: number;
}

export interface ResolveEscalationInput {
  notes?: string;
  resolvedByUserId: string;
}
