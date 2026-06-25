"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { QueueBoard } from "@/components/wildcat/sales/queue-board";
import { DeskView } from "@/components/wildcat/sales/desk-view";
import type { Prospect } from "@/lib/wildcat/sales";

type SalesTab = "queue" | "desk";

const TABS: { value: SalesTab; label: string }[] = [
  { value: "queue", label: "Queue" },
  { value: "desk", label: "Desk" },
];

export function SalesWorkspace({ prospects: initial }: { prospects: Prospect[] }) {
  const [tab, setTab] = useState<SalesTab>("queue");
  // The lineup is shared: reordering in the Queue changes the dial order on the
  // Desk, since the Desk reads each day's prospects in array order.
  const [prospects, setProspects] = useState<Prospect[]>(initial);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "font-heading text-2xl font-semibold tracking-tight transition-colors",
              tab === t.value
                ? "text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "queue" ? (
        <QueueBoard prospects={prospects} onChange={setProspects} />
      ) : (
        <DeskView prospects={prospects} onChange={setProspects} />
      )}
    </div>
  );
}
