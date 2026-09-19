import { afterEach, describe, expect, it } from "vitest";
import { getSystemPrompt } from "@/lib/ai/soap-note/prompt";
import {
  createStubSoapNoteProvider,
  getSoapParseModelName,
  getSoapTranscribeModelName,
  isOpenAiConfigured,
  transcribeAndParseSoapNote,
} from "@/lib/ai/soap-note/provider";

// Verbatim clinic-specified spec text this task was given (see Task 7 /
// Area 3 Step 2 description) — do not paraphrase, reformat, or "fix" it.
const EXACT_SYSTEM_PROMPT = `You are an expert veterinary clinical scribe. Your task is to process a free-form audio transcription spoken by a veterinarian in Hebrew and accurately parse it into a structured JSON object representing a clinical SOAP note.

CRITICAL INSTRUCTIONS:
1. Output strictly valid JSON with the keys: "S", "O", "A", "P".
2. Keep the content in HEBREW (עברית) using professional veterinary terminology.
3. Do NOT omit any medical metrics. Extract weights, body temperatures (חום), heart rates (דופק), respiratory rates (נשימה), and specific medication dosages exactly as stated.
4. Categorization Rules:
   - "S" (סובייקטיבי): Owner's complaint, background history, behavior, and appetite at home.
   - "O" (אובייקטיבי): All physical exam findings, TPR metrics, body condition score, and lab/imaging results mentioned.
   - "A" (הערכה): Diagnoses, tentative diagnoses, or differential lists.
   - "P" (תוכנית טיפול): Medications prescribed (with names, dosages, durations), recommended follow-ups, and instructions given to the owner.
5. If a certain metric or section is not mentioned, leave it empty. Do not hallucinate or invent clinical findings.`;

describe("soap-note prompt", () => {
  it("system prompt is byte-for-byte the clinic-approved wording", () => {
    expect(getSystemPrompt()).toBe(EXACT_SYSTEM_PROMPT);
  });
});

describe("soap-note provider", () => {
  const originalEnv = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SOAP_TRANSCRIBE_MODEL: process.env.SOAP_TRANSCRIBE_MODEL,
    SOAP_PARSE_MODEL: process.env.SOAP_PARSE_MODEL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  describe("isOpenAiConfigured", () => {
    it("returns false when OPENAI_API_KEY is unset or blank", () => {
      delete process.env.OPENAI_API_KEY;
      expect(isOpenAiConfigured()).toBe(false);

      process.env.OPENAI_API_KEY = "   ";
      expect(isOpenAiConfigured()).toBe(false);
    });

    it("returns true when OPENAI_API_KEY is set", () => {
      process.env.OPENAI_API_KEY = "sk-test-123";
      expect(isOpenAiConfigured()).toBe(true);
    });
  });

  describe("getSoapTranscribeModelName", () => {
    it("defaults to whisper-1 when unset", () => {
      delete process.env.SOAP_TRANSCRIBE_MODEL;
      expect(getSoapTranscribeModelName()).toBe("whisper-1");
    });

    it("uses the env override when set", () => {
      process.env.SOAP_TRANSCRIBE_MODEL = "gpt-4o-transcribe";
      expect(getSoapTranscribeModelName()).toBe("gpt-4o-transcribe");
    });
  });

  describe("getSoapParseModelName", () => {
    it("defaults to gpt-4o-mini when unset", () => {
      delete process.env.SOAP_PARSE_MODEL;
      expect(getSoapParseModelName()).toBe("gpt-4o-mini");
    });

    it("uses the env override when set", () => {
      process.env.SOAP_PARSE_MODEL = "gpt-4o";
      expect(getSoapParseModelName()).toBe("gpt-4o");
    });
  });

  describe("createStubSoapNoteProvider", () => {
    it("resolves with a sensible default draft, without any network access", async () => {
      const provider = createStubSoapNoteProvider();
      const result = await provider.transcribeAndParse(
        new ArrayBuffer(0),
        "audio/wav",
      );

      expect(result.modelName).toBe("stub");
      expect(result.transcriptText.length).toBeGreaterThan(0);
      expect(result.draft.S).toBeTruthy();
      expect(result.draft.O).toBeTruthy();
      expect(result.draft.A).toBeTruthy();
      expect(result.draft.P).toBeTruthy();
    });

    it("allows overriding individual SOAP fields", async () => {
      const provider = createStubSoapNoteProvider({ S: "תלונה מותאמת", A: null });
      const result = await provider.transcribeAndParse(
        new ArrayBuffer(0),
        "audio/wav",
      );

      expect(result.draft.S).toBe("תלונה מותאמת");
      expect(result.draft.A).toBeNull();
      // Untouched fields keep their sensible defaults.
      expect(result.draft.O).toBeTruthy();
      expect(result.draft.P).toBeTruthy();
    });

    it("transcribeAudio resolves independently, without ever calling parseTranscript", async () => {
      const provider = createStubSoapNoteProvider();
      const result = await provider.transcribeAudio(new ArrayBuffer(0), "audio/wav");

      expect(result.modelName).toBe("stub");
      expect(result.transcriptText.length).toBeGreaterThan(0);
      // transcribeAudio's result shape has no `draft` — it's transcription only.
      expect(result).not.toHaveProperty("draft");
    });

    it("parseTranscript resolves independently from arbitrary transcript text, without touching audio", async () => {
      const provider = createStubSoapNoteProvider({ P: "תוכנית מותאמת" });
      const result = await provider.parseTranscript("כל טקסט תמלול שרירותי");

      expect(result.modelName).toBe("stub");
      expect(result.draft.P).toBe("תוכנית מותאמת");
      expect(result.draft.S).toBeTruthy();
      // parseTranscript's result shape has no `transcriptText`.
      expect(result).not.toHaveProperty("transcriptText");
    });

    it("transcribeAndParse composes transcribeAudio and parseTranscript", async () => {
      const provider = createStubSoapNoteProvider();
      const [transcribed, parsed, combined] = await Promise.all([
        provider.transcribeAudio(new ArrayBuffer(0), "audio/wav"),
        provider.parseTranscript("טקסט כלשהו"),
        provider.transcribeAndParse(new ArrayBuffer(0), "audio/wav"),
      ]);

      expect(combined.transcriptText).toBe(transcribed.transcriptText);
      expect(combined.draft).toEqual(parsed.draft);
      expect(combined.modelName).toBe(parsed.modelName);
    });
  });

  describe("transcribeAndParseSoapNote", () => {
    it("resolves to the stub provider under test/vitest env without needing OPENAI_API_KEY", async () => {
      delete process.env.OPENAI_API_KEY;
      const result = await transcribeAndParseSoapNote(new ArrayBuffer(0), "audio/wav");
      expect(result.modelName).toBe("stub");
    });

    it("uses an explicitly passed provider even when one isn't given by default", async () => {
      const customProvider = createStubSoapNoteProvider({ P: "תוכנית מותאמת" });
      const result = await transcribeAndParseSoapNote(
        new ArrayBuffer(0),
        "audio/wav",
        customProvider,
      );
      expect(result.draft.P).toBe("תוכנית מותאמת");
    });
  });
});
