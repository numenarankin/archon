"use client";

import { useCallback, useRef, useState } from "react";
import { startCall } from "@/lib/wildcat/sales-actions";

export type DialState =
  | "idle"
  | "connecting"
  | "ringing"
  | "active"
  | "ended"
  | "error";

// Minimal shapes for the parts of @telnyx/webrtc we use. The SDK is loaded
// lazily (dynamic import) so the build does not require it until installed.
interface TelnyxCall {
  state: string;
  hangup(): void;
  muteAudio(): void;
  unmuteAudio(): void;
}

interface TelnyxNotification {
  type: string;
  call?: TelnyxCall;
}

interface TelnyxClient {
  remoteElement?: HTMLMediaElement | string;
  on(event: string, cb: (payload: TelnyxNotification) => void): TelnyxClient;
  connect(): void;
  disconnect(): void;
  newCall(opts: {
    destinationNumber: string;
    callerNumber?: string;
    callerName?: string;
    clientState?: string;
  }): TelnyxCall;
}

interface TelnyxModule {
  TelnyxRTC: new (opts: { login_token: string }) => TelnyxClient;
}

export interface DialerProspect {
  id: string;
  phone: string;
}

/**
 * Browser softphone driving Telnyx WebRTC. Fetches a JWT from /api/telnyx/token,
 * connects the client, and places the call returned by the startCall action
 * (which selects the local-presence caller id and creates the sales_calls row).
 * Returns the active callId so the Desk can subscribe to its live transcript.
 */
export function useTelnyxDialer() {
  const clientRef = useRef<TelnyxClient | null>(null);
  const callRef = useRef<TelnyxCall | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [state, setState] = useState<DialState>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);

  const ensureClient = useCallback(async (): Promise<TelnyxClient> => {
    if (clientRef.current) return clientRef.current;

    const res = await fetch("/api/telnyx/token", { method: "POST" });
    if (!res.ok) throw new Error(`Token request failed (${res.status})`);
    const { token } = (await res.json()) as { token: string };

    // Lazy-loaded (code-split) so the SDK only ships to clients that dial.
    const mod = (await import("@telnyx/webrtc")) as unknown as TelnyxModule;
    const client = new mod.TelnyxRTC({ login_token: token });
    if (audioRef.current) client.remoteElement = audioRef.current;

    await new Promise<void>((resolve, reject) => {
      client.on("telnyx.ready", () => resolve());
      client.on("telnyx.error", () => reject(new Error("Telnyx client error")));
      client.connect();
    });

    client.on("telnyx.notification", (n) => {
      if (n.type !== "callUpdate" || !n.call) return;
      const s = n.call.state;
      if (s === "ringing" || s === "trying" || s === "requesting") setState("ringing");
      else if (s === "active") setState("active");
      else if (s === "hangup" || s === "destroy") {
        setState("ended");
        callRef.current = null;
      }
    });

    clientRef.current = client;
    return client;
  }, []);

  const dial = useCallback(
    async (prospect: DialerProspect) => {
      setError(null);
      setMuted(false);
      setState("connecting");
      try {
        const start = await startCall({ prospectId: prospect.id, phone: prospect.phone });
        if (!start.ok || !start.callerNumber || !start.destinationNumber) {
          throw new Error(start.error ?? "Could not start the call.");
        }
        const client = await ensureClient();
        callRef.current = client.newCall({
          destinationNumber: start.destinationNumber,
          callerNumber: start.callerNumber,
          callerName: "Wildcat",
          clientState: start.clientState,
        });
        setCallId(start.callId ?? null);
        return start.callId ?? null;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Dial failed.");
        setState("error");
        return null;
      }
    },
    [ensureClient]
  );

  const hangup = useCallback(() => {
    callRef.current?.hangup();
    callRef.current = null;
    setState("ended");
  }, []);

  const toggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    if (muted) {
      call.unmuteAudio();
      setMuted(false);
    } else {
      call.muteAudio();
      setMuted(true);
    }
  }, [muted]);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setMuted(false);
    setCallId(null);
  }, []);

  return { state, muted, error, callId, audioRef, dial, hangup, toggleMute, reset };
}
