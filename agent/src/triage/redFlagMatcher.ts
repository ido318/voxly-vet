import { RED_FLAGS } from "../knowledge/red-flags.js";

export type RedFlag = {
  id: string;
  name_he: string;
  urgency: number;
  applies_to: string[];
  safe_question_he: string;
};

export function matchRedFlags(
  symptoms: string,
  additionalSigns: string[] = [],
  petSpecies?: string,
): RedFlag[] {
  const haystack = [symptoms, ...additionalSigns].join(" ").toLowerCase();

  const matched: RedFlag[] = [];
  for (const flag of RED_FLAGS) {
    if (petSpecies && !flag.applies_to.includes(petSpecies)) continue;

    const hit = flag.triggers_he.some((trigger) => hasNonNegatedTrigger(haystack, trigger));
    if (hit) {
      matched.push({
        id: flag.id,
        name_he: flag.name_he,
        urgency: flag.urgency,
        applies_to: [...flag.applies_to],
        safe_question_he: flag.safe_question_he,
      });
    }
  }

  return matched;
}

function hasNonNegatedTrigger(haystack: string, trigger: string): boolean {
  const normalizedTrigger = trigger.toLowerCase();
  let index = haystack.indexOf(normalizedTrigger);

  while (index !== -1) {
    if (!isNegatedTrigger(haystack, normalizedTrigger, index)) {
      return true;
    }
    index = haystack.indexOf(normalizedTrigger, index + normalizedTrigger.length);
  }

  return false;
}

function isNegatedTrigger(haystack: string, trigger: string, triggerIndex: number): boolean {
  if (trigger.startsWith("לא ") || trigger.startsWith("אין ") || trigger.startsWith("אינו ") || trigger.startsWith("אינה ")) {
    return false;
  }

  const prefix = haystack
    .slice(Math.max(0, triggerIndex - 24), triggerIndex)
    .replace(/[,.!?;:()[\]״"׳']/g, " ")
    .replace(/\s+/g, " ");

  return /(?:^|\s)ו?(אין|לא|ללא|בלי|אינו|אינה)\s+$/.test(prefix);
}
