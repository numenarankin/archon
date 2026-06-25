import { hasElevenLabs } from "@/lib/env";
import { transcribeAudio } from "@/lib/ai/tts";
import { forbidUnlessPermitted } from "@/lib/auth/permissions";

// Transcription of a short utterance is quick, but give it headroom.
export const maxDuration = 60;

/** POST raw audio bytes → { text } transcript (ElevenLabs Scribe). */
export async function POST(req: Request) {
  // Capability gate: voice input is part of the AI feature set (`use_ai`).
  const denied = await forbidUnlessPermitted("use_ai");
  if (denied) return denied;

  if (!hasElevenLabs()) {
    return new Response("ELEVEN_LABS_KEY not configured", { status: 503 });
  }

  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) {
    return new Response("Empty audio body", { status: 400 });
  }

  const contentType = req.headers.get("content-type") || "audio/webm";
  try {
    const text = await transcribeAudio(buf, contentType);
    return Response.json({ text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transcription failed";
    return new Response(message, { status: 502 });
  }
}
