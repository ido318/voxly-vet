import type { AuditService } from "@/lib/services/audit.service";
import type { CreateAuditLogInput } from "@/types/domain/audit-log";

export async function logAuditAction(
  auditService: AuditService,
  input: CreateAuditLogInput,
) {
  return auditService.logAction(input);
}
