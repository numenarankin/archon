"use client";

import { create } from "zustand";
import type { AiSelection } from "@/lib/ai/page-context";

interface AiContextState {
  /** The file/folder the user currently has selected, or null. */
  selection: AiSelection | null;
  setSelection: (selection: AiSelection | null) => void;
}

/**
 * Global state for what the user has selected (a file or folder), so the Archon
 * drawer chat — rendered once in the app shell — can stay aware of the active
 * file/folder from any page. Pages publish their selection here; the chat panel
 * reads it (alongside the route) to ground the assistant.
 */
export const useAiContext = create<AiContextState>((set) => ({
  selection: null,
  setSelection: (selection) => set({ selection }),
}));
