import { hasElevenLabs } from "@/lib/env";
import { MAX_TTS_CHARS, streamSpeech } from "@/lib/ai/tts";
import { forbidUnlessPermitted } from "@/lib/auth/permissions";

// Synthesis of a long answer can take a few seconds; give it room.
export const maxDuration = 60;

interface VoiceRequest {
  text?: string;
  /** What was spoken just before this clip, for prosody continuity. */
  previousText?: string;
}

/** POST { text, previousText? } → MP3 audio stream of Archon reading it aloud. */
export async function POST(req: Request) {
  // Capability gate: read-aloud is part of the AI feature set (`use_ai`).
  const denied = await forbidUnlessPermitted("use_ai");
  if (denied) return denied;

  if (!hasElevenLabs()) {
    return new Response("ELEVEN_LABS_KEY not configured", { status: 503 });
  }

  let text = "";
  let previousText: string | undefined;
  try {
    const body = (await req.json()) as VoiceRequest;
    text = typeof body.text === "string" ? body.text.trim() : "";
    previousText =
      typeof body.previousText === "string" && body.previousText.trim()
        ? body.previousText.trim()
        : undefined;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!text) return new Response("Missing text", { status: 400 });
  const clipped = text.length > MAX_TTS_CHARS ? text.slice(0, MAX_TTS_CHARS) : text;

  try {
    const audio = await streamSpeech(clipped, previousText);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Speech synthesis failed";
    return new Response(message, { status: 502 });
  }
}
