"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WellsTable } from "@/components/wells/wells-table";
import {
  WellInfoDialog,
  type WellInfo,
} from "@/components/wells/well-info-dialog";
import { createWell } from "@/lib/wells/actions";
import type { Well } from "@/lib/wells/wells";

const EMPTY_INFO: WellInfo = {
  name: "",
  formation: "",
  county: "",
  depth: 0,
  perforations: "",
  dateDrilled: "",
  coordinates: "",
  oilBblPerInch: 1,
};

/**
 * Client wrapper for the Wells page: header + "New Well" action and the table.
 * Creating a well persists via the `createWell` server action, then refreshes
 * the route so the new (clickable) row appears.
 */
export function WellsList({ wells }: { wells: Well[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCreate(info: WellInfo) {
    startTransition(async () => {
      try {
        await createWell(info);
        router.refresh();
      } catch (error) {
        console.error("Failed to create well", error);
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Wells
        </h1>
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          disabled={isPending}
          className="bg-black text-white hover:bg-neutral-800"
        >
          <PlusIcon />
          New Well
        </Button>
      </div>

      <WellsTable wells={wells} />

      <WellInfoDialog
        open={open}
        onOpenChange={setOpen}
        info={EMPTY_INFO}
        title="New well"
        submitLabel="Create well"
        onSave={handleCreate}
      />
    </div>
  );
}
