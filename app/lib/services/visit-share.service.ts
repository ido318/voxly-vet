import { randomBytes } from "crypto";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { getEnv } from "@/lib/env";
import { sendSms } from "@/lib/integrations/twilio/sms";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import type { VisitRepository } from "@/lib/repositories/visit.repository";
import type { VisitShareRepository } from "@/lib/repositories/visit-share.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { ServiceActor } from "@/lib/services/service-context";

const SHARE_TTL_DAYS = 7;

export type CreateAndSendResult = {
  url: string;
  shareId: string;
  recipientPhone: string;
};

function generateToken(): string {
  // 32 bytes of entropy, URL-safe.
  return randomBytes(32).toString("base64url");
}

export class VisitShareService {
  constructor(
    private readonly visitRepository: VisitRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly petRepository: PetRepository,
    private readonly prescriptionRepository: PrescriptionRepository,
    private readonly visitShareRepository: VisitShareRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a tokenized share link for a visit's summary + prescriptions and
   * deliver it to the client by SMS. Access is enforced by verifying the visit
   * belongs to one of the actor's clinics.
   */
  async createAndSend(
    actor: ServiceActor,
    visitId: string,
    options: { origin?: string } = {},
  ): Promise<Result<CreateAndSendResult>> {
    const visitResult = await this.visitRepository.findById(visitId);
    if (!visitResult.ok) return visitResult;
    const visit = visitResult.value;
    if (!visit) return err(AppError.notFound("הביקור לא נמצא"));
    if (!actor.clinicIds.includes(visit.clinicId)) {
      return err(AppError.forbidden("אין לך גישה לביקור הזה"));
    }

    const summary = visit.aiVisitSummary ?? visit.manualVisitSummary;
    const prescriptionsResult = await this.prescriptionRepository.listByVisit(visitId);
    if (!prescriptionsResult.ok) return prescriptionsResult;
    const prescriptions = prescriptionsResult.value.filter((p) => p.status === "active");

    if (!summary && prescriptions.length === 0) {
      return err(
        AppError.validation("אין סיכום ביקור או מרשמים פעילים לשליחה ללקוח"),
      );
    }

    const customerResult = await this.customerRepository.findById(visit.customerId);
    if (!customerResult.ok) return customerResult;
    const customer = customerResult.value;
    if (!customer) return err(AppError.notFound("הלקוח לא נמצא"));
    if (!customer.phone) {
      return err(AppError.validation("ללקוח אין מספר טלפון לשליחת SMS"));
    }

    const petResult = await this.petRepository.findById(visit.petId);
    if (!petResult.ok) return petResult;
    const petName = petResult.value?.name ?? "בעל החיים שלך";

    const token = generateToken();
    const baseUrl = (options.origin ?? getEnv().APP_BASE_URL).replace(/\/$/, "");
    const url = `${baseUrl}/s/${token}`;
    const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const created = await this.visitShareRepository.create({
      clinicId: visit.clinicId,
      visitId,
      token,
      channel: "sms",
      recipientPhone: customer.phone,
      createdByUserId: actor.userId,
      expiresAt,
    });
    if (!created.ok) return created;

    const hasSummary = Boolean(summary);
    const hasRx = prescriptions.length > 0;
    const what =
      hasSummary && hasRx
        ? "סיכום הביקור והמרשמים"
        : hasSummary
          ? "סיכום הביקור"
          : "המרשמים";
    const body = `שלום, ${what} של ${petName} ממרפאת Demo Vet Clinic:\n${url}`;

    try {
      const { sid } = await sendSms(customer.phone, body);
      await this.visitShareRepository.markSent(created.value.id, sid);
    } catch (error) {
      // Revoke the just-created share so a failed send never leaves a live,
      // undelivered link behind; then surface the delivery failure.
      await this.visitShareRepository.revoke(created.value.id).catch(() => undefined);
      if (error instanceof AppError) return err(error);
      return err(AppError.externalProvider("שליחת ה-SMS נכשלה", error));
    }

    await this.auditService.logAction({
      clinicId: visit.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "visit_share.send",
      entityType: "visit_share",
      entityId: created.value.id,
      afterPayload: { visitId, channel: "sms", recipientPhone: customer.phone },
    });

    return ok({ url, shareId: created.value.id, recipientPhone: customer.phone });
  }
}
