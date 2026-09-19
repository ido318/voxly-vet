export type AuditActorType = "user" | "system" | "ai";

export type AuditLog = {
  id: string;
  clinicId: string | null;
  actorType: AuditActorType;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforePayload: Record<string, unknown> | null;
  afterPayload: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CreateAuditLogInput = {
  clinicId?: string | null;
  actorType: AuditActorType;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforePayload?: Record<string, unknown> | null;
  afterPayload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};
