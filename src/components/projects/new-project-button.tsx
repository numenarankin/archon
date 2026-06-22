"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { PlusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProject } from "@/lib/projects/actions";

export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        await createProject(trimmed);
        setName("");
        setOpen(false);
        router.refresh();
      } catch (error) {
        console.error("Failed to create project", error);
      }
    });
  }

  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="bg-black text-white hover:bg-neutral-800"
      >
        <PlusIcon />
        New Project
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup
            className={cn(
              "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
              "flex w-[92vw] max-w-[420px] flex-col",
              "overflow-hidden rounded-xl border border-border bg-background-surface shadow-xl",
              "transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
            )}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
              <Dialog.Title className="ty-body-1 font-semibold text-primary-text">
                New project
              </Dialog.Title>
              <Dialog.Close
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Close" />
                }
              >
                <XIcon />
              </Dialog.Close>
            </header>

            <div className="flex flex-col gap-4 px-5 py-4">
              <label className="flex flex-col gap-1.5">
                <span className="ty-body-2 font-medium text-primary-text">
                  Name
                </span>
                <Input
                  value={name}
                  autoFocus
                  placeholder="e.g. Spraberry Study"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                />
              </label>
            </div>

            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Dialog.Close
                render={<Button variant="outline" size="sm">Cancel</Button>}
              />
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!name.trim() || isPending}
              >
                Create project
              </Button>
            </footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
