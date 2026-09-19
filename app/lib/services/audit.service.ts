import type { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { err, ok, type Result } from "@/lib/errors/app-error";
import type { AuditLog, CreateAuditLogInput } from "@/types/domain/audit-log";

export class AuditService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async logAction(input: CreateAuditLogInput): Promise<Result<AuditLog>> {
    const result = await this.auditLogRepository.insert(input);

    if (!result.ok) {
      return err(result.error);
    }

    return ok(result.value);
  }
}
