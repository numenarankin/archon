import { anthropic } from "@ai-sdk/anthropic";
import { after } from "next/server";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { assembleSystemPrompt } from "@/lib/ai/system-prompt";
import { buildManifestCached } from "@/lib/ai/manifest";
import { archonTools } from "@/lib/ai/tools";
import { loadContextDocs } from "@/lib/ai/context/docs";
import { latestUserText, reflectOnTurn } from "@/lib/ai/reflection";
import { getProfile } from "@/lib/settings/profile";
import { forbidUnlessPermitted } from "@/lib/auth/permissions";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  countWebSearchRequests,
  gateAI,
  meterAnthropic,
  meterAnthropicWebSearch,
} from "@/lib/billing/credits";

// Tool round-trips can take a while; allow longer than a plain completion.
export const maxDuration = 120;

/**
 * Spoken-conversation styling. Archon's answers here are read aloud, so they must
 * sound like natural speech, not a formatted document.
 */
const VOICE_STYLE = `\n\n---\n\n## Voice mode — OPTIMIZE FOR INFORMATION DENSITY\n\nYou are speaking out loud in a live, hands-free voice conversation. The user is the boss and is in charge. Talk like a really sharp analyst who respects the boss's time and mental space: every sentence earns its place, nothing is wasted, and the complete thought lands cleanly.\n\nHard rules:\n- Maximize information per word. Express the COMPLETE thought — answer, the key reason or number behind it, and any consequence that changes what they'd do — then stop. Don't truncate a real answer into a teaser, and don't pad it either.\n- Cut everything superfluous: no preamble ("Great question", "Sure, let me…"), no restating their question, no sign-off, no hedging, no filler. If a word can go without losing meaning, drop it.\n- Stay conversationally smooth — natural spoken prose that flows when read aloud, not a clipped list of facts. Usually one to three tight sentences; go longer only when the substance genuinely requires it, never to sound thorough.\n- Lead with the answer, then the support. Surface the thing that matters most first.\n- Plain spoken prose only — no markdown, headings, lists, tables, code, or emoji.\n- Say numbers conversationally ("about twelve hundred barrels a day", not "1,200 bbl/d"). Never read ids, slugs, file names, or URLs.\n- If the request is genuinely ambiguous, ask one short clarifying question instead of guessing.\n\nDensity with zero waste is the whole job: say everything that matters, nothing that doesn't.\n\n## Taking action (write tools)\n\nYou can make changes — create tasks, wells, calendar events, log production, and so on. Every such tool requires the user's explicit approval before it runs: when you call one, the user sees a confirmation card and taps Approve or Deny. So before you call a write tool, say in one short spoken sentence exactly what you're about to do, phrased as a confirmation — e.g. "I'll create a task to inspect well twelve — approve it on screen and I'll add it." Then make the call. Don't announce success until the action has actually gone through; after it does, confirm in a few words. If the user denies it, acknowledge briefly and move on.`;

interface VoiceChatRequest {
  messages: UIMessage[];
  /** Where the user currently is (route), if known. */
  pageContext?: string;
}

export async function POST(req: Request) {
  // Capability gate: block callers without `use_ai` before invoking the model.
  const denied = await forbidUnlessPermitted("use_ai");
  if (denied) return denied;

  // AI-credit gate (see /api/chat for the rationale).
  const sb = await getSupabaseServer();
  const gate = await gateAI(sb);
  if (!gate.allowed) {
    return Response.json(
      { error: "ai_unavailable", reason: gate.reason },
      { status: 402 },
    );
  }

  const { messages, pageContext }: VoiceChatRequest = await req.json();

  const [docs, manifest, profile] = await Promise.all([
    loadContextDocs(),
    buildManifestCached(),
    getProfile(),
  ]);
  const system =
    assembleSystemPrompt({
      docs,
      manifest,
      user: { name: profile.name, company: profile.companyName },
      pageContext,
    }) + VOICE_STYLE;

  // Full tool access, including write tools. Each write tool is marked
  // `needsApproval`, so the SDK pauses the run and streams an approval-request
  // part instead of executing; the voice client surfaces a tap-to-approve card
  // (just like the typed drawer) and replays the approved message to resume.
  const tools = archonTools();

  const userText = latestUserText(messages);

  const result = streamText({
    // Opus for voice too: spoken answers are optimized for information density,
    // not raw brevity, so the reasoning depth is worth the small extra latency
    // before the first sentence streams.
    model: anthropic("claude-opus-4-8"),
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(8),
    onFinish: ({ totalUsage, steps, text }) => {
      void meterAnthropic(
        {
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
        },
        "voice-chat",
        sb,
      );
      void meterAnthropicWebSearch(
        countWebSearchRequests(steps),
        "voice-chat:web_search",
        sb,
      );
      // Self-improvement loop, in the background after the spoken turn finishes.
      after(() => reflectOnTurn({ userText, assistantText: text }));
    },
  });

  // UI-message stream (not plain text) so tool-approval parts reach the voice
  // client alongside the spoken text. The client reads text deltas for TTS and
  // watches for approval-request parts to render the confirmation card.
  //
  // By default the UI-message stream masks stream errors as the literal string
  // "An error occurred." and keeps the HTTP status at 200, so a mid-stream
  // failure (e.g. during an approval resume) reaches the client only as an
  // empty stream. Log the real cause server-side and forward a readable
  // message so the voice client can surface it instead of a generic failure.
  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[voice-chat] stream error", error);
      return error instanceof Error ? error.message : "voice-chat stream failed";
    },
  });
}
