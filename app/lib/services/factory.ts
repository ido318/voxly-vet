import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AIEventRepository } from "@/lib/repositories/ai-event.repository";
import { AiSummaryRepository } from "@/lib/repositories/ai-summary.repository";
import { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { CalendarBlockRepository } from "@/lib/repositories/calendar-block.repository";
import { ClinicRepository } from "@/lib/repositories/clinic.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { InvoiceRepository } from "@/lib/repositories/invoice.repository";
import { InventoryRepository } from "@/lib/repositories/inventory.repository";
import { FollowUpRepository } from "@/lib/repositories/follow-up.repository";
import { PaymentRepository } from "@/lib/repositories/payment.repository";
import { PriceListItemRepository } from "@/lib/repositories/price-list-item.repository";
import { VisitChargeRepository } from "@/lib/repositories/visit-charge.repository";
import { LabOrderRepository } from "@/lib/repositories/lab-order.repository";
import { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";
import { MedicalRecordRepository } from "@/lib/repositories/medical-record.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import { PromptSuggestionRepository } from "@/lib/repositories/prompt-suggestion.repository";
import { CallReviewRepository } from "@/lib/repositories/call-review.repository";
import { ProfileRepository } from "@/lib/repositories/profile.repository";
import { TaskRepository } from "@/lib/repositories/task.repository";
import { VaccinationRepository } from "@/lib/repositories/vaccination.repository";
import { VisitRepository } from "@/lib/repositories/visit.repository";
import { VisitShareRepository } from "@/lib/repositories/visit-share.repository";
import { WaitlistRepository } from "@/lib/repositories/waitlist.repository";
import { VitalRepository } from "@/lib/repositories/vital.repository";
import { AIEventService } from "@/lib/services/ai-event.service";
import { AiArtifactService } from "@/lib/services/ai-artifact.service";
import { AppointmentService } from "@/lib/services/appointment.service";
import { AuditService } from "@/lib/services/audit.service";
import { AuthService } from "@/lib/services/auth.service";
import { CalendarBlockService } from "@/lib/services/calendar-block.service";
import { CalendarService } from "@/lib/services/calendar.service";
import { ClinicSettingsService } from "@/lib/services/clinic-settings.service";
import { CustomerService } from "@/lib/services/customer.service";
import { HealthService } from "@/lib/services/health.service";
import { InvoiceService } from "@/lib/services/invoice.service";
import { InventoryService } from "@/lib/services/inventory.service";
import { FollowUpService } from "@/lib/services/follow-up.service";
import { PaymentService } from "@/lib/services/payment.service";
import { PriceListItemService } from "@/lib/services/price-list-item.service";
import { GreenInvoiceService } from "@/lib/services/green-invoice.service";
import { VisitChargeService } from "@/lib/services/visit-charge.service";
import { LabOrderService } from "@/lib/services/lab-order.service";
import { MedicalRecordService } from "@/lib/services/medical-record.service";
import { PetService } from "@/lib/services/pet.service";
import { VisitService } from "@/lib/services/visit.service";
import { VisitSummaryAssistantService } from "@/lib/services/visit-summary-assistant.service";
import { PromptSuggestionService } from "@/lib/services/prompt-suggestion.service";
import { CallReviewService } from "@/lib/services/call-review.service";
import { TaskService } from "@/lib/services/task.service";
import { VisitShareService } from "@/lib/services/visit-share.service";
import { VoiceCallService } from "@/lib/services/voice-call.service";
import { WaitlistService } from "@/lib/services/waitlist.service";
import { VoiceCallRepository } from "@/lib/repositories/voice-call.repository";
import { EscalationService } from "@/lib/services/escalation.service";
import { DashboardNotificationsService } from "@/lib/services/dashboard-notifications.service";
import { NotificationDispatcher } from "@/lib/services/notification-dispatcher";
import { CustomerMessageService } from "@/lib/services/customer-message.service";

export async function createServices() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const profileRepository = new ProfileRepository(supabase);
  const clinicRepository = new ClinicRepository(supabase);
  const customerRepository = new CustomerRepository(supabase);
  const petRepository = new PetRepository(supabase);
  const appointmentRepository = new AppointmentRepository(supabase);
  const calendarBlockRepository = new CalendarBlockRepository(supabase);
  const waitlistRepository = new WaitlistRepository(supabase);
  const visitRepository = new VisitRepository(supabase);
  const voiceCallRepository = new VoiceCallRepository(supabase);
  const medicalNoteRepository = new MedicalNoteRepository(supabase);
  const medicalRecordRepository = new MedicalRecordRepository(supabase);
  const vaccinationRepository = new VaccinationRepository(supabase);
  const prescriptionRepository = new PrescriptionRepository(supabase);
  const invoiceRepository = new InvoiceRepository(supabase);
  const inventoryRepository = new InventoryRepository(supabase);
  const followUpRepository = new FollowUpRepository(supabase);
  const paymentRepository = new PaymentRepository(supabase);
  const visitChargeRepository = new VisitChargeRepository(supabase);
  const priceListItemRepository = new PriceListItemRepository(supabase);
  const taskRepository = new TaskRepository(supabase);
  const labOrderRepository = new LabOrderRepository(supabase);
  const vitalRepository = new VitalRepository(supabase);
  const visitShareRepository = new VisitShareRepository(admin);
  const promptSuggestionRepository = new PromptSuggestionRepository(admin);
  const callReviewRepository = new CallReviewRepository(admin);
  const auditLogRepository = new AuditLogRepository(admin);
  const aiEventRepository = new AIEventRepository(admin);
  const aiSummaryRepository = new AiSummaryRepository(supabase);
  const auditService = new AuditService(auditLogRepository);
  // Admin, not the session client: notifications_log has RLS enabled with only a
  // SELECT policy for members, so an INSERT through the user session is rejected
  // and the approve/reject flow queues nothing at all.
  const dashboardNotificationsService = new DashboardNotificationsService(admin);
  const taskService = new TaskService(taskRepository);
  const followUpService = new FollowUpService(followUpRepository, taskService);
  const greenInvoiceService = new GreenInvoiceService();
  const invoiceService = new InvoiceService(
    invoiceRepository,
    auditService,
    customerRepository,
    greenInvoiceService,
  );

  const medicalRecordService = new MedicalRecordService(
    visitRepository,
    medicalNoteRepository,
    vaccinationRepository,
    prescriptionRepository,
    petRepository,
    auditService,
    medicalRecordRepository,
    vitalRepository,
    labOrderRepository,
    customerRepository,
    dashboardNotificationsService,
  );

  return {
    auth: new AuthService(supabase, profileRepository, clinicRepository),
    health: new HealthService(admin),
    audit: auditService,
    aiEvent: new AIEventService(aiEventRepository),
    aiArtifact: new AiArtifactService(aiSummaryRepository, new AIEventService(aiEventRepository)),
    customer: new CustomerService(customerRepository, petRepository, auditService),
    pet: new PetService(petRepository, customerRepository, auditService, medicalRecordService),
    escalation: new EscalationService(supabase),
    dashboardNotifications: dashboardNotificationsService,
    appointment: new AppointmentService(
      appointmentRepository,
      customerRepository,
      petRepository,
      auditService,
      dashboardNotificationsService,
      visitRepository,
      medicalRecordService,
      new NotificationDispatcher(),
    ),
    customerMessage: new CustomerMessageService(customerRepository, admin, auditService),
    calendar: new CalendarService(appointmentRepository, calendarBlockRepository),
    calendarBlock: new CalendarBlockService(calendarBlockRepository),
    waitlist: new WaitlistService(waitlistRepository),
    invoice: invoiceService,
    inventory: new InventoryService(inventoryRepository),
    payment: new PaymentService(paymentRepository, invoiceRepository),
    visitCharge: new VisitChargeService(visitChargeRepository, visitRepository, invoiceRepository),
    priceListItem: new PriceListItemService(priceListItemRepository),
    task: taskService,
    followUp: followUpService,
    labOrder: new LabOrderService(labOrderRepository),
    clinicSettings: new ClinicSettingsService(clinicRepository, auditService),
    visit: new VisitService(
      visitRepository,
      customerRepository,
      petRepository,
      appointmentRepository,
      auditService,
      medicalRecordService,
      followUpService,
    ),
    medicalRecord: medicalRecordService,
    visitSummaryAssistant: new VisitSummaryAssistantService(
      visitRepository,
      medicalNoteRepository,
      prescriptionRepository,
      petRepository,
      auditService,
      new AIEventService(aiEventRepository),
    ),
    visitShare: new VisitShareService(
      visitRepository,
      customerRepository,
      petRepository,
      prescriptionRepository,
      visitShareRepository,
      auditService,
    ),
    voiceCall: new VoiceCallService(voiceCallRepository),
    promptSuggestion: new PromptSuggestionService(promptSuggestionRepository),
    callReview: new CallReviewService(callReviewRepository, promptSuggestionRepository),
  };
}

export function createAdminServices() {
  const admin = createSupabaseAdminClient();
  return {
    audit: new AuditService(new AuditLogRepository(admin)),
    aiEvent: new AIEventService(new AIEventRepository(admin)),
    health: new HealthService(admin),
  };
}
