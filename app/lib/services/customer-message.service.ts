import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { sendSms } from "@/lib/integrations/twilio/sms";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { ServiceActor } from "@/lib/services/service-context";

export type SendCustomerMessageResult = {
  channel: "sms";
  recipientPhone: string;
  body: string;
  twilioMessageSid: string | null;
};

const MAX_BODY_LENGTH = 800;

export class CustomerMessageService {
  constructor(
    private readonly customerRepository: CustomerRepository,
    /** Admin client: notifications_log grants members SELECT only. */
    private readonly notificationsClient: SupabaseClient,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Send a one-off SMS to a client from the dashboard and record it, so the
   * message history lives with the clinic rather than on a staff member's phone.
   */
  async sendSmsToCustomer(
    actor: ServiceActor,
    customerId: string,
    body: string,
  ): Promise<Result<SendCustomerMessageResult>> {
    const trimmed = body.trim();
    if (!trimmed) return err(AppError.validation("אי אפשר לשלוח הודעה ריקה"));
    if (trimmed.length > MAX_BODY_LENGTH) {
      return err(AppError.validation(`ההודעה ארוכה מדי (מקסימום ${MAX_BODY_LENGTH} תווים)`));
    }

    const customerResult = await this.customerRepository.findById(customerId);
    if (!customerResult.ok) return customerResult;
    const customer = customerResult.value;
    if (!customer) return err(AppError.notFound("הלקוח לא נמצא"));
    if (!actor.clinicIds.includes(customer.clinicId)) {
      return err(AppError.forbidden("אין לך גישה ללקוח הזה"));
    }
    if (!customer.phone) {
      return err(AppError.validation("ללקוח אין מספר טלפון"));
    }

    let twilioMessageSid: string | null = null;
    try {
      const sent = await sendSms(customer.phone, trimmed);
      twilioMessageSid = sent.sid;
    } catch (error) {
      if (error instanceof AppError) return err(error);
      return err(AppError.externalProvider("שליחת ה-SMS נכשלה", error));
    }

    // Logged after a confirmed send: a row here means it actually left Twilio.
    const nowIso = new Date().toISOString();
    const { error: logError } = await this.notificationsClient.from("notifications_log").insert({
      clinic_id: customer.clinicId,
      customer_id: customer.id,
      phone: customer.phone,
      type: "manual_message",
      status: "sent",
      body: trimmed,
      scheduled_for: nowIso,
      sent_at: nowIso,
      twilio_message_sid: twilioMessageSid,
    });
    if (logError) {
      // The client already has the message; failing the request would invite a
      // duplicate send, so record the gap and report success.
      console.error("[customer-message] SMS sent but logging failed", logError);
    }

    await this.auditService.logAction({
      clinicId: customer.clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "customer.message.send",
      entityType: "customer",
      entityId: customer.id,
      afterPayload: { channel: "sms", recipientPhone: customer.phone, length: trimmed.length },
    });

    return ok({
      channel: "sms",
      recipientPhone: customer.phone,
      body: trimmed,
      twilioMessageSid,
    });
  }
}
