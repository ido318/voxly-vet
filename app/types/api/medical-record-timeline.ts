import type { LabOrder } from "@/types/domain/lab-order";
import type { MedicalNote } from "@/types/domain/medical-note";
import type { Prescription } from "@/types/domain/prescription";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Visit } from "@/types/domain/visit";
import type { Vital } from "@/types/domain/vital";

export type MedicalRecordTimelineType =
  | "visit"
  | "medical_note"
  | "vital"
  | "prescription"
  | "vaccination"
  | "lab_order";

export type MedicalRecordTimelineItem = {
  id: string;
  type: MedicalRecordTimelineType;
  occurredAt: string;
  title: string;
  subtitle: string | null;
  sourceVisitId: string | null;
  sourceHref: string;
  data: Visit | MedicalNote | Vital | Prescription | Vaccination | LabOrder;
};

export type MedicalRecordTimelineResponse = {
  items: MedicalRecordTimelineItem[];
};
