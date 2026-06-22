"use client";

import { create } from "zustand";

interface KBState {
  /** folderId -> expanded? */
  expanded: Record<string, boolean>;
  toggleFolder: (folderId: string) => void;
  setExpanded: (folderId: string, expanded: boolean) => void;
}

export const useKBStore = create<KBState>((set) => ({
  expanded: {},
  toggleFolder: (folderId) =>
    set((s) => ({
      expanded: { ...s.expanded, [folderId]: !s.expanded[folderId] },
    })),
  setExpanded: (folderId, expanded) =>
    set((s) => ({ expanded: { ...s.expanded, [folderId]: expanded } })),
}));
