import { describe, expect, it } from "vitest";
import { decideConversationPolicy } from "../../../src/services/conversation-policy.service.js";

describe("conversation policy", () => {
  it("asks focused Hebrew follow-up questions before triage for mild vomiting", () => {
    const policy = decideConversationPolicy({
      user_utterance_he: "הכלב טיפה מקיא ולא מרגיש טוב",
      known_pet_type: "כלב",
      known_symptoms_he: "טיפה מקיא ולא מרגיש טוב",
    });

    expect(policy.stage).toBe("medical_intake");
    expect(policy.next_action).toBe("ask_follow_up");
    expect(policy.ask_he).toContain("כמה פעמים");
    expect(policy.guardrails_he.join(" ")).toContain("לא להפנות לבית חולים");
  });

  it("routes clear emergency red flags to emergency referral", () => {
    const policy = decideConversationPolicy({
      user_utterance_he: "הכלב מנסה להקיא ולא יוצא לו כלום והבטן נפוחה וקשה",
      known_pet_type: "כלב",
      known_symptoms_he: "מנסה להקיא ולא יוצא כלום",
      red_flag_answers_he: ["בטן נפוחה וקשה", "מנסה להקיא ולא יוצא"],
    });

    expect(policy.stage).toBe("medical_triage");
    expect(policy.next_action).toBe("emergency_referral");
    expect(policy.say_he).toContain("בית חולים וטרינרי");
  });

  it("does not route negated red flag answers to emergency referral", () => {
    const policy = decideConversationPolicy({
      user_utterance_he: "הוא הקיא פעמיים, אין דם ואין בטן נפוחה או קשה",
      known_pet_type: "כלב",
      known_symptoms_he: "הקיא פעמיים",
      red_flag_answers_he: ["אין דם", "אין בטן נפוחה", "הבטן לא קשה"],
    });

    expect(policy.next_action).not.toBe("emergency_referral");
    expect(policy.stage).toBe("medical_intake");
    expect(policy.ask_he).toContain("כמה פעמים");
  });

  it("recovers from repeated answers instead of repeating the same question", () => {
    const policy = decideConversationPolicy({
      user_utterance_he: "כבר אמרתי לך, הוא הקיא פעמיים",
      known_pet_type: "כלב",
      known_symptoms_he: "הקיא",
      last_agent_action: "ask_vomit_frequency",
      repeated_turns: 2,
    });

    expect(policy.next_action).toBe("recover_from_loop");
    expect(policy.say_he).toContain("צודק");
    expect(policy.ask_he).not.toContain("כמה פעמים");
  });
});
