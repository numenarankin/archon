"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon, Loader2Icon, UsersIcon, UserIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  listShares,
  listShareTargets,
  shareResource,
  unshareResource,
  type ResourceShare,
  type SharePerson,
  type ShareResourceType,
} from "@/lib/files/sharing";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ShareResourceType;
  resourceId: string;
  resourceName: string;
}

/**
 * Share a file or folder with a specific workspace member or the whole
 * workspace, view-only or with edit. Reflects the `resource_shares` ACL the RLS
 * enforces — the resource stays private to its owner until shared here.
 */
export function ShareDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName,
}: ShareDialogProps) {
  const [shares, setShares] = useState<ResourceShare[]>([]);
  const [people, setPeople] = useState<SharePerson[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([listShares(resourceType, resourceId), listShareTargets()])
      .then(([s, t]) => {
        if (cancelled) return;
        setShares(s);
        setPeople(t.people);
        setWorkspaceId(t.workspaceId);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, resourceType, resourceId]);

  async function refresh() {
    setShares(await listShares(resourceType, resourceId));
  }

  async function add(granteeKind: "user" | "workspace", granteeId: string, canEdit: boolean) {
    setBusy(true);
    setError(null);
    try {
      await shareResource({ resourceType, resourceId, granteeKind, granteeId, canEdit });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't share.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: ResourceShare) {
    setBusy(true);
    setError(null);
    try {
      await unshareResource(resourceType, resourceId, s.granteeKind, s.granteeId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove.");
    } finally {
      setBusy(false);
    }
  }

  const sharedWorkspace = shares.find((s) => s.granteeKind === "workspace");
  const sharedUserIds = new Set(
    shares.filter((s) => s.granteeKind === "user").map((s) => s.granteeId)
  );
  const unshared = people.filter((p) => !sharedUserIds.has(p.userId));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "flex max-h-[80vh] w-[92vw] max-w-[460px] flex-col",
            "overflow-hidden rounded-xl border border-border bg-background-surface shadow-xl",
            "transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          )}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
            <Dialog.Title className="ty-body-1 font-semibold text-primary-text">
              Share “{resourceName}”
            </Dialog.Title>
            <Dialog.Close render={<Button variant="ghost" size="icon-sm" aria-label="Close" />}>
              <XIcon />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2Icon className="animate-spin text-tertiary-text" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Whole-workspace toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="size-4 text-data-accent" />
                    <span className="ty-body-2 text-primary-text">Everyone in the workspace</span>
                  </div>
                  {sharedWorkspace ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => remove(sharedWorkspace)}
                    >
                      Remove
                    </Button>
                  ) : (
                    workspaceId && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => add("workspace", workspaceId, false)}
                      >
                        Share
                      </Button>
                    )
                  )}
                </div>

                {/* Current per-user shares */}
                {shares.filter((s) => s.granteeKind === "user").length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="ty-caption text-tertiary-text">Shared with</p>
                    {shares
                      .filter((s) => s.granteeKind === "user")
                      .map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg px-2 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <UserIcon className="size-4 text-tertiary-text" />
                            <span className="ty-body-2 text-primary-text">{s.label}</span>
                            <span className="ty-caption text-tertiary-text">
                              {s.canEdit ? "can edit" : "can view"}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove"
                            disabled={busy}
                            onClick={() => remove(s)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}

                {/* Add a member */}
                {unshared.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="ty-caption text-tertiary-text">Add a member</p>
                    {unshared.map((p) => (
                      <div
                        key={p.userId}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-background-hover"
                      >
                        <div className="flex items-center gap-2">
                          <UserIcon className="size-4 text-tertiary-text" />
                          <span className="ty-body-2 text-primary-text">{p.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => add("user", p.userId, false)}
                          >
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => add("user", p.userId, true)}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
