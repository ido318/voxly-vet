import type { Visit } from "@/types/domain/visit";

export type GenerateVisitSummaryResponse = {
  draftText: string;
  modelName: string;
  aiEventId: string;
};

export type AcceptVisitSummaryResponse = {
  visit: Visit;
};
