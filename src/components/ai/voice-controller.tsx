"use client";

import { usePathname } from "next/navigation";
import { MicIcon, Loader2Icon, AudioLinesIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceMode } from "@/lib/ai/use-voice-mode";
import { useAiDrawer } from "@/lib/ai/use-ai-drawer";
import {
  useVoiceConversation,
  type VoiceStatus,
} from "@/lib/ai/use-voice-conversation";
import { ApprovalCard } from "@/components/ai/tool-approval";

// Re-exported for existing importers (e.g. the topbar toggle).
export { isVoiceInputSupported } from "@/lib/ai/use-voice-conversation";

/** Routes that own the voice UI themselves (full-page), so the overlay yields. */
function ownsVoiceInline(pathname: string): boolean {
  return pathname === "/archon" || pathname.startsWith("/archon/");
}

/**
 * Small floating status overlay for hands-free Archon voice. Mounted once in the
 * app shell; runs the shared voice loop as the fallback host. It yields (no mic
 * loop, no overlay) to any surface that renders voice inline: the open Archon
 * drawer, or the full-page /archon chat. Exactly one host runs the loop at a time.
 */
export function VoiceController() {
  const enabled = useVoiceMode((s) => s.enabled);
  const setEnabled = useVoiceMode((s) => s.setEnabled);
  const drawerOpen = useAiDrawer((s) => s.open);
  const pathname = usePathname();
  // Other surfaces own the loop: the drawer (when open) and /archon. The drawer
  // wins over /archon, so the overlay defers whenever either is active.
  const deferred = drawerOpen || ownsVoiceInline(pathname);

  const {
    status,
    lastUser,
    liveReply,
    error,
    pendingApprovals,
    respondToApproval,
  } = useVoiceConversation({
    enabled: enabled && !deferred,
    onEnd: () => setEnabled(false),
  });

  if (!enabled || deferred) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="ty-caption flex-1 font-medium text-primary-text">
            {status === "listening" && "Listening…"}
            {status === "thinking" && "Archon is thinking…"}
            {status === "speaking" && "Archon is speaking — talk to interrupt"}
            {status === "idle" && "Starting…"}
          </span>
          <button
            type="button"
            aria-label="End voice conversation"
            onClick={() => setEnabled(false)}
            className="rounded p-1 text-tertiary-text transition-colors hover:bg-background-hover hover:text-primary-text"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {lastUser && (
          <p className="mt-2 ty-body-2 text-tertiary-text">
            <span className="text-primary-text">You: </span>
            {lastUser}
          </p>
        )}
        {liveReply && status !== "listening" && (
          <p className="mt-1 ty-body-2 text-primary-text">
            <span className="text-data-accent">Archon: </span>
            {liveReply}
          </p>
        )}
        {pendingApprovals.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {pendingApprovals.map((req) => (
              <ApprovalCard
                key={req.id}
                request={req}
                onApprove={() => respondToApproval(req.id, true)}
                onDeny={() => respondToApproval(req.id, false)}
              />
            ))}
          </div>
        )}
        {error && <p className="mt-2 ty-caption text-error">{error}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: VoiceStatus }) {
  if (status === "thinking") {
    return (
      <Loader2Icon className="size-4 shrink-0 animate-spin text-data-accent" />
    );
  }
  if (status === "speaking") {
    return <AudioLinesIcon className="size-4 shrink-0 text-data-accent" />;
  }
  // listening / idle
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <span
        className={cn(
          "absolute inline-flex size-full rounded-full bg-data-accent/40",
          status === "listening" && "animate-ping",
        )}
      />
      <MicIcon className="size-3.5 text-data-accent" />
    </span>
  );
}
