import type { MedicalRecord } from "@/types/domain/medical-record";
import type { MedicalNote } from "@/types/domain/medical-note";
import type { Prescription } from "@/types/domain/prescription";
import type { Vaccination } from "@/types/domain/vaccination";

export type MedicalRecordResponse = {
  item: MedicalRecord;
};

export type MedicalNoteListResponse = {
  items: MedicalNote[];
};

export type VaccinationListResponse = {
  items: Vaccination[];
};

export type PrescriptionListResponse = {
  items: Prescription[];
};
