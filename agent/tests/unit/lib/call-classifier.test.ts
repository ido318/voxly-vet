import { describe, it, expect } from "vitest";
import { classifyCallCategory } from "../../../src/lib/callClassifier.js";

describe("classifyCallCategory", () => {
  it("returns 'information' for a payload with no tool calls", () => {
    const payload = {
      conversation_id: "conv_info",
      transcript: [
        { role: "user", message: "מה שעות הפתיחה שלכם?", time_in_call_secs: 1 },
        { role: "agent", message: "אנחנו פתוחים ראשון עד חמישי...", time_in_call_secs: 3 },
      ],
    };
    expect(classifyCallCategory(payload)).toBe("information");
  });

  it("returns 'operation' when transcript contains a book_appointment tool call", () => {
    const payload = {
      conversation_id: "conv_book",
      transcript: [
        { role: "user", message: "אני רוצה לקבוע תור", time_in_call_secs: 1 },
        {
          role: "agent",
          tool_calls: [{ tool_name: "book-appointment", input: {} }],
          time_in_call_secs: 5,
        },
      ],
    };
    expect(classifyCallCategory(payload)).toBe("operation");
  });

  it("returns 'operation' for cancel_or_reschedule", () => {
    const payload = {
      conversation_id: "conv_cancel",
      transcript: [
        {
          role: "agent",
          tool_calls: [{ tool_name: "cancel-or-reschedule", input: {} }],
          time_in_call_secs: 4,
        },
      ],
    };
    expect(classifyCallCategory(payload)).toBe("operation");
  });

  it("returns 'operation' for escalate_to_vet", () => {
    const payload = {
      conversation_id: "conv_esc",
      transcript: [
        {
          role: "agent",
          tool_calls: [{ tool_name: "escalate-to-vet", input: {} }],
          time_in_call_secs: 8,
        },
      ],
    };
    expect(classifyCallCategory(payload)).toBe("operation");
  });

  it("returns 'operation' for triage-pet-case", () => {
    const payload = {
      conversation_id: "conv_triage",
      transcript: [
        {
          role: "agent",
          tool_calls: [{ tool_name: "triage-pet-case", input: {} }],
          time_in_call_secs: 6,
        },
      ],
    };
    expect(classifyCallCategory(payload)).toBe("operation");
  });

  it("returns 'information' when payload has no transcript field", () => {
    const payload = { conversation_id: "conv_no_transcript" };
    expect(classifyCallCategory(payload)).toBe("information");
  });

  it("returns 'information' when transcript is an empty array", () => {
    const payload = { conversation_id: "conv_empty", transcript: [] };
    expect(classifyCallCategory(payload)).toBe("information");
  });

  it("returns 'operation' for join-waitlist", () => {
    const payload = {
      conversation_id: "conv_waitlist",
      transcript: [
        {
          role: "agent",
          tool_calls: [{ tool_name: "join-waitlist" }],
          time_in_call_secs: 7,
        },
      ],
    };
    expect(classifyCallCategory(payload)).toBe("operation");
  });

  it("ignores lookup-customer tool (information-only tool)", () => {
    const payload = {
      conversation_id: "conv_lookup",
      transcript: [
        {
          role: "agent",
          tool_calls: [{ tool_name: "lookup-customer" }],
          time_in_call_secs: 2,
        },
        { role: "user", message: "תודה, להתראות", time_in_call_secs: 10 },
      ],
    };
    expect(classifyCallCategory(payload)).toBe("information");
  });
});
