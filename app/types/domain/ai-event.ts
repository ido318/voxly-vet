export type AIEvent = {
  id: string;
  clinicId: string;
  sourceType: string;
  sourceId: string | null;
  agentName: string;
  eventType: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  confidence: number | null;
  modelName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CreateAIEventInput = {
  clinicId: string;
  sourceType: string;
  sourceId?: string | null;
  agentName: string;
  eventType: string;
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  confidence?: number | null;
  modelName?: string | null;
  metadata?: Record<string, unknown>;
};
