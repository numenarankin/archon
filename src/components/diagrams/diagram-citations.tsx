"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LinkIcon, XIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  findMentionCandidates,
  loadOutgoingCitations,
  addBridge,
  removeBridge,
} from "@/lib/files/graph-actions";
import type { MentionCandidate } from "@/lib/kb/types";

type Citation = Awaited<ReturnType<typeof loadOutgoingCitations>>[number];

const PANEL_WIDTH = 288; // w-72

/**
 * "Cite document" control for the diagram canvas: lets the user link this
 * diagram to other documents (creating bridges with this diagram as the
 * source), and lists/removes existing links. Unlike the markdown editor's
 * @-mentions — which are reconciled from the doc body on save — a diagram has no
 * text body, so these bridges are written directly via addBridge/removeBridge.
 *
 * The dropdown is portalled to <body> with a very high z-index because tldraw's
 * own panels (the style/color selector) portal to <body> too; rendering inline
 * would let those panels paint over it.
 */
export function DiagramCitations({ fileId }: { fileId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MentionCandidate[]>([]);
  const [cites, setCites] = useState<Citation[]>([]);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(
    () =>
      loadOutgoingCitations(fileId)
        .then(setCites)
        .catch((error) => console.error("loadOutgoingCitations failed", error)),
    [fileId]
  );

  const reposition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - PANEL_WIDTH),
    });
  }, []);

  // Load existing links + an initial result list when the panel opens.
  useEffect(() => {
    if (!open) return;
    reposition();
    refresh();
    findMentionCandidates("", undefined, fileId)
      .then(setResults)
      .catch((error) => console.error("findMentionCandidates failed", error));
  }, [open, fileId, refresh, reposition]);

  // Debounced search as the user types.
  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      findMentionCandidates(query, undefined, fileId)
        .then(setResults)
        .catch((error) => console.error("findMentionCandidates failed", error));
    }, 150);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, open, fileId]);

  // Keep the portalled panel pinned to the button; close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  const linkedIds = new Set(cites.map((c) => c.targetFileId));

  async function handleAdd(item: MentionCandidate) {
    if (linkedIds.has(item.id) || busy) return;
    setBusy(true);
    try {
      await addBridge(fileId, item.id, "cite", { createdBy: "user" });
      await refresh();
    } catch (error) {
      console.error("addBridge failed", error);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(bridgeId: string) {
    setCites(cites.filter((c) => c.id !== bridgeId));
    try {
      await removeBridge(bridgeId);
    } catch (error) {
      console.error("removeBridge failed", error);
      refresh();
    }
  }

  const unlinked = results.filter((r) => !linkedIds.has(r.id));

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={open}
        onClick={() => setOpen((v) => !v)}
      >
        <LinkIcon />
        Cite document
        {cites.length > 0 && (
          <span className="ml-1 rounded-full bg-accent px-1.5 text-xs">
            {cites.length}
          </span>
        )}
      </Button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: PANEL_WIDTH,
              // Above tldraw's body-portalled UI panels.
              zIndex: 2147483000,
            }}
            className="overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
          >
            {cites.length > 0 && (
              <div className="border-b border-border p-2">
                <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                  Linked documents
                </p>
                <ul className="space-y-0.5">
                  {cites.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm"
                    >
                      <span className="truncate">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemove(c.id)}
                        aria-label={`Remove link to ${c.name}`}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents to cite…"
              autoFocus
              className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <ul className="max-h-56 overflow-y-auto py-1">
              {unlinked.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  No matching documents
                </li>
              ) : (
                unlinked.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAdd(item)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                        "hover:bg-accent/50 disabled:opacity-50"
                      )}
                    >
                      <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.name}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
