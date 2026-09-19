export type {
  AIEvent,
  CreateAIEventInput,
} from "@/types/domain/ai-event";

export const AgentNames = {
  TOMER: "tomer",
  SYSTEM: "system",
} as const;

export type AgentName = (typeof AgentNames)[keyof typeof AgentNames];
