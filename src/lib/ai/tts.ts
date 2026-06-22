import "server-only";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/**
 * Archon's default voice. A JARVIS-style British assistant voice from the
 * ElevenLabs voice library; override per-deployment with `ELEVENLABS_VOICE_ID`.
 */
const DEFAULT_VOICE_ID = "yJSTU8D97YocC6Dqg20L";

/**
 * Flash v2.5 — ~75ms latency, 0.5 credits/char. Built for real-time / on-demand
 * synthesis, which is what a "read this answer aloud" button wants.
 */
const MODEL_ID = "eleven_flash_v2_5";

/** Safety cap so a runaway message can't rack up a huge synthesis bill. */
export const MAX_TTS_CHARS = 5000;

let client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  const apiKey = process.env.ELEVEN_LABS_KEY;
  if (!apiKey) throw new Error("ELEVEN_LABS_KEY not configured");
  if (!client) client = new ElevenLabsClient({ apiKey });
  return client;
}

/** The voice id Archon speaks with. */
export function getVoiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
}

/**
 * Synthesize `text` to speech and return an MP3 audio stream. The caller is
 * responsible for trimming/validating `text` (see `MAX_TTS_CHARS`).
 */
export async function streamSpeech(
  text: string,
  previousText?: string
): Promise<ReadableStream<Uint8Array>> {
  return getClient().textToSpeech.stream(getVoiceId(), {
    text,
    modelId: MODEL_ID,
    outputFormat: "mp3_44100_128",
    // Continuity hint: telling the model what was just spoken keeps prosody
    // consistent across separately-synthesized sentence clips.
    ...(previousText ? { previousText } : {}),
  });
}

/**
 * Transcribe recorded audio to text via ElevenLabs Scribe. Used by the voice
 * loop instead of the browser's Web Speech API, which depends on Google's
 * speech service and fails (`network` error) in many browsers/environments.
 */
export async function transcribeAudio(
  data: ArrayBuffer,
  contentType: string
): Promise<string> {
  const blob = new Blob([data], { type: contentType || "audio/webm" });
  const res = await getClient().speechToText.convert({
    file: blob,
    modelId: "scribe_v1",
  });
  const text = (res as { text?: string }).text ?? "";
  return text.trim();
}
