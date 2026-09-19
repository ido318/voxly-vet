import { createOpenAI } from "@ai-sdk/openai";
import { experimental_transcribe as transcribe, generateObject } from "ai";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/ai/soap-note/prompt";
import type {
  SoapNoteDraft,
  SoapNoteGenerationResult,
  SoapNoteProvider,
  SoapParseResult,
  SoapTranscriptionResult,
} from "@/lib/ai/soap-note/types";

const soapNoteDraftSchema = z.object({
  S: z.string().nullable(),
  O: z.string().nullable(),
  A: z.string().nullable(),
  P: z.string().nullable(),
});

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getSoapTranscribeModelName(): string {
  return process.env.SOAP_TRANSCRIBE_MODEL ?? "whisper-1";
}

export function getSoapParseModelName(): string {
  return process.env.SOAP_PARSE_MODEL ?? "gpt-4o-mini";
}

export function createOpenAiSoapNoteProvider(): SoapNoteProvider {
  async function transcribeAudio(
    audio: ArrayBuffer | Uint8Array,
    mimeType: string,
  ): Promise<SoapTranscriptionResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const openai = createOpenAI({ apiKey });
    const transcribeModelName = getSoapTranscribeModelName();

    // Note: the installed `ai` SDK's `experimental_transcribe` has no
    // parameter to force the audio media type — it auto-detects it from
    // the byte signature (falling back to audio/wav) and does not accept
    // an override. `mimeType` is accepted here for interface parity with
    // callers (who know the recorded file's real content type) but is not
    // forwarded to the SDK call. See the JSDoc on
    // `SoapNoteProvider.transcribeAudio` in types.ts for the full rationale.
    void mimeType;

    const transcriptionResult = await transcribe({
      model: openai.transcription(transcribeModelName),
      audio,
    });

    const transcriptText = transcriptionResult.text.trim();
    if (!transcriptText) {
      throw new Error("Transcription returned empty text");
    }

    return { transcriptText, modelName: transcribeModelName };
  }

  async function parseTranscript(transcriptText: string): Promise<SoapParseResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const openai = createOpenAI({ apiKey });
    const parseModelName = getSoapParseModelName();

    const { object } = await generateObject({
      model: openai(parseModelName),
      system: getSystemPrompt(),
      prompt: transcriptText,
      schema: soapNoteDraftSchema,
    });

    return { draft: object, modelName: parseModelName };
  }

  async function transcribeAndParse(
    audio: ArrayBuffer | Uint8Array,
    mimeType: string,
  ): Promise<SoapNoteGenerationResult> {
    const { transcriptText } = await transcribeAudio(audio, mimeType);
    const { draft, modelName } = await parseTranscript(transcriptText);
    return { draft, modelName, transcriptText };
  }

  return { transcribeAudio, parseTranscript, transcribeAndParse };
}

export function createStubSoapNoteProvider(
  overrides?: Partial<SoapNoteDraft>,
): SoapNoteProvider {
  const draft: SoapNoteDraft = {
    S: "בעלים מדווח על תיאבון ירוד ועייפות קלה בבית.",
    O: "טמפרטורה 38.9 מעלות, דופק 110, נשימה תקינה. מצב גוף תקין.",
    A: "חשד לזיהום קל בדרכי העיכול.",
    P: "מנוחה ומעקב, חזרה לביקורת בעוד שבוע אם אין שיפור.",
    ...overrides,
  };
  const stubTranscriptText = "תמלול לדוגמה לצורכי בדיקות.";

  async function transcribeAudio(): Promise<SoapTranscriptionResult> {
    return { transcriptText: stubTranscriptText, modelName: "stub" };
  }

  async function parseTranscript(): Promise<SoapParseResult> {
    return { draft, modelName: "stub" };
  }

  async function transcribeAndParse(): Promise<SoapNoteGenerationResult> {
    const { transcriptText } = await transcribeAudio();
    const { draft: parsedDraft, modelName } = await parseTranscript();
    return { draft: parsedDraft, modelName, transcriptText };
  }

  return { transcribeAudio, parseTranscript, transcribeAndParse };
}

export async function transcribeAndParseSoapNote(
  audio: ArrayBuffer | Uint8Array,
  mimeType: string,
  provider?: SoapNoteProvider,
): Promise<SoapNoteGenerationResult> {
  const resolved =
    provider ??
    (process.env.VITEST === "true" || process.env.NODE_ENV === "test"
      ? createStubSoapNoteProvider()
      : createOpenAiSoapNoteProvider());

  return resolved.transcribeAndParse(audio, mimeType);
}

/**
 * Parses an already-transcribed dictation into a structured SOAP draft,
 * resolving to the real OpenAI-backed provider or the deterministic stub
 * the same way `transcribeAndParseSoapNote` does — an explicit `provider`
 * wins, otherwise test envs get the stub and everything else gets the real
 * provider. Callers (e.g. `AiArtifactService`) that only need the parse step
 * (transcription already happened upstream) should use this instead of
 * duplicating the env-based resolution logic themselves.
 */
export async function parseSoapNoteTranscript(
  transcriptText: string,
  provider?: Pick<SoapNoteProvider, "parseTranscript">,
): Promise<SoapParseResult> {
  const resolved =
    provider ??
    (process.env.VITEST === "true" || process.env.NODE_ENV === "test"
      ? createStubSoapNoteProvider()
      : createOpenAiSoapNoteProvider());

  return resolved.parseTranscript(transcriptText);
}
