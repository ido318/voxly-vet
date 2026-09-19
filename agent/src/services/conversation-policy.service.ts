export type ConversationStage =
  | "greeting"
  | "medical_intake"
  | "medical_triage"
  | "booking"
  | "general";

export type ConversationNextAction =
  | "ask_pet_type"
  | "ask_symptom_duration"
  | "ask_follow_up"
  | "call_triage_tool"
  | "offer_appointment"
  | "emergency_referral"
  | "recover_from_loop"
  | "continue_naturally";

export interface ConversationPolicyInput {
  user_utterance_he: string;
  known_pet_type?: "כלב" | "חתול" | "אחר";
  known_symptoms_he?: string;
  known_duration_he?: string;
  red_flag_answers_he?: string[];
  last_agent_action?: string;
  repeated_turns?: number;
}

export interface ConversationPolicyResult {
  stage: ConversationStage;
  next_action: ConversationNextAction;
  say_he: string;
  ask_he?: string;
  guardrails_he: string[];
}

const emergencySignals = [
  "בטן נפוחה",
  "בטן קשה",
  "מנסה להקיא ולא יוצא",
  "לא יוצא לו כלום",
  "דם",
  "קוצר נשימה",
  "מתמוטט",
  "פרכוס",
  "לא עומד",
  "חיוור",
];

const vomitingSignals = ["מקיא", "הקיא", "הקאות", "קיא"];

function includesAny(text: string, signals: string[]): boolean {
  return signals.some((signal) => hasNonNegatedSignal(text, signal));
}

function hasNonNegatedSignal(text: string, signal: string): boolean {
  let index = text.indexOf(signal);

  while (index !== -1) {
    if (!isNegatedSignal(text, signal, index)) {
      return true;
    }
    index = text.indexOf(signal, index + signal.length);
  }

  return false;
}

function isNegatedSignal(text: string, signal: string, signalIndex: number): boolean {
  if (signal.startsWith("לא ") || signal.startsWith("אין ") || signal.startsWith("אינו ") || signal.startsWith("אינה ")) {
    return false;
  }

  const prefix = text
    .slice(Math.max(0, signalIndex - 24), signalIndex)
    .replace(/[,.!?;:()[\]״"׳']/g, " ")
    .replace(/\s+/g, " ");

  return /(?:^|\s)ו?(אין|לא|ללא|בלי|אינו|אינה)\s+$/.test(prefix);
}

function hasEmergencySignal(input: ConversationPolicyInput): boolean {
  const joined = [
    input.user_utterance_he,
    input.known_symptoms_he ?? "",
    ...(input.red_flag_answers_he ?? []),
  ].join(" ");

  return includesAny(joined, emergencySignals);
}

function isLoop(input: ConversationPolicyInput): boolean {
  const text = input.user_utterance_he;
  return (input.repeated_turns ?? 0) >= 2 || text.includes("כבר אמרתי") || text.includes("אתה חוזר");
}

export function decideConversationPolicy(input: ConversationPolicyInput): ConversationPolicyResult {
  if (isLoop(input)) {
    return {
      stage: "medical_intake",
      next_action: "recover_from_loop",
      say_he: "צודק, קלטתי. אני לא אשאל את זה שוב.",
      ask_he: "רק כדי להתקדם נכון: יש דם, בטן נפוחה וקשה, או ניסיון להקיא בלי שיוצא כלום?",
      guardrails_he: [
        "אל תחזור על אותה שאלה.",
        "סכם את מה שכבר נאמר במשפט אחד.",
        "התקדם לשאלה הבאה בלבד.",
      ],
    };
  }

  if (hasEmergencySignal(input)) {
    return {
      stage: "medical_triage",
      next_action: "emergency_referral",
      say_he: "זה כבר נשמע כמו סימן חירום. במקרה כזה לא מחכים לתור רגיל, כדאי לפנות עכשיו לבית חולים וטרינרי פתוח.",
      guardrails_he: [
        "הפנה לבית חולים רק כשיש דגל חירום ברור.",
        "אל תיתן אבחנה רפואית.",
        "דבר קצר וברור, בלי להפחיד מעבר לנדרש.",
      ],
    };
  }

  if (!input.known_pet_type) {
    return {
      stage: "medical_intake",
      next_action: "ask_pet_type",
      say_he: "מבין.",
      ask_he: "מדובר בכלב או בחתול?",
      guardrails_he: [
        "שאלה אחת בכל פעם.",
        "לא להפנות לבית חולים לפני איסוף פרטים בסיסיים.",
      ],
    };
  }

  if (includesAny(input.user_utterance_he + " " + (input.known_symptoms_he ?? ""), vomitingSignals)) {
    return {
      stage: "medical_intake",
      next_action: "ask_follow_up",
      say_he: "מבין, בוא נבדוק כמה דברים חשובים לפני שקובעים.",
      ask_he: "כמה פעמים הוא הקיא היום?",
      guardrails_he: [
        "לא להפנות לבית חולים על הקאה קלה בלי דגל חירום.",
        "אל תאבחן ואל תרגיע רפואית.",
        "אחרי תשובה לשאלה הזו שאל בקצרה על דם, בטן נפוחה וקשה, או ניסיון להקיא בלי שיוצא.",
      ],
    };
  }

  if (!input.known_duration_he && input.known_symptoms_he) {
    return {
      stage: "medical_intake",
      next_action: "ask_symptom_duration",
      say_he: "הבנתי.",
      ask_he: "ממתי זה התחיל?",
      guardrails_he: [
        "שאלה אחת בכל פעם.",
        "לא להפנות לבית חולים בלי דגל חירום ברור.",
      ],
    };
  }

  return {
    stage: input.known_symptoms_he ? "medical_triage" : "general",
    next_action: input.known_symptoms_he ? "call_triage_tool" : "continue_naturally",
    say_he: input.known_symptoms_he
      ? "יש לי מספיק פרטים ראשוניים, אני בודק מה נכון לעשות עכשיו."
      : "בסדר, אני איתך.",
    guardrails_he: [
      "דבר בעברית טבעית וקצרה.",
      "אל תחזור מילה במילה על תשובות כלים.",
      "אם אין חירום, המשך להצעת תור אצל ד\"ר דנה.",
    ],
  };
}

export function formatConversationPolicyForVoice(policy: ConversationPolicyResult): string {
  const parts = [
    `שלב: ${policy.stage}`,
    `פעולה הבאה: ${policy.next_action}`,
    `אמור עכשיו: ${policy.say_he}`,
  ];

  if (policy.ask_he) {
    parts.push(`שאל שאלה אחת: ${policy.ask_he}`);
  }

  parts.push(`כללי התנהגות: ${policy.guardrails_he.join(" | ")}`);
  return parts.join("\n");
}
