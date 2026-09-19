export type SoapNoteDraft = {
  S: string | null;
  O: string | null;
  A: string | null;
  P: string | null;
};

export type SoapNoteGenerationResult = {
  draft: SoapNoteDraft;
  modelName: string;
  transcriptText: string;
};

export type SoapTranscriptionResult = {
  transcriptText: string;
  modelName: string;
};

export type SoapParseResult = {
  draft: SoapNoteDraft;
  modelName: string;
};

export type SoapNoteProvider = {
  /**
   * Transcribes raw dictation audio into plain text.
   *
   * @param audio - Raw audio bytes.
   * @param mimeType - The recorded file's content type (e.g. "audio/webm").
   *   Accepted here for forward-compatibility with providers/SDK versions
   *   that DO support an explicit media-type override on transcription.
   *   The OpenAI implementation (`createOpenAiSoapNoteProvider` in
   *   `provider.ts`) intentionally does NOT forward this to the SDK call:
   *   the installed `ai` 6.0.x SDK's `experimental_transcribe` auto-detects
   *   the audio format itself from a magic-byte signature (falling back to
   *   `audio/wav` when it can't detect one) and has no parameter to accept
   *   a caller-supplied override. See `provider.ts` for the specifics.
   */
  transcribeAudio(
    audio: ArrayBuffer | Uint8Array,
    mimeType: string,
  ): Promise<SoapTranscriptionResult>;

  /**
   * Parses an already-transcribed dictation into a structured SOAP draft.
   * Does not touch audio or re-run transcription — useful once a vet has
   * reviewed/corrected the transcript text (e.g. a mis-transcribed dosage)
   * and only wants to (re-)run the structured parse.
   */
  parseTranscript(transcriptText: string): Promise<SoapParseResult>;

  /**
   * Convenience method that runs `transcribeAudio` then `parseTranscript`
   * in sequence. See `transcribeAudio` for the `mimeType` caveat.
   */
  transcribeAndParse(
    audio: ArrayBuffer | Uint8Array,
    mimeType: string,
  ): Promise<SoapNoteGenerationResult>;
};
