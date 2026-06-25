"use client";

import { useCallback, useState } from "react";
import { PlusIcon } from "lucide-react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "@/components/ui/button";
import { PipelineColumn } from "@/components/numena/pipeline-column";
import { DealModal, type NewDeal } from "@/components/numena/deal-modal";
import {
  PIPELINE_STAGES,
  type Deal,
  type DealStage,
} from "@/lib/numena/pipeline";

/**
 * Sales pipeline kanban. Mirrors the Tasks board (drag deals between stage
 * columns, click to edit, add via a modal) but is entirely client-side — there
 * is no backend yet, so changes live in component state and reset on reload.
 */
export function PipelineBoard({ deals: initial }: { deals: Deal[] }) {
  const [deals, setDeals] = useState<Deal[]>(initial);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);

  const handleDropDeal = useCallback((dealId: string, stage: DealStage) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage } : d))
    );
  }, []);

  const handleOpenDeal = useCallback((deal: Deal) => setEditing(deal), []);

  function handleAddDeal(deal: NewDeal) {
    setDeals((prev) => [{ id: `deal-local-${Date.now()}`, ...deal }, ...prev]);
  }

  function handleSaveDeal(deal: NewDeal) {
    if (!editing) return;
    const id = editing.id;
    setDeals((prev) => prev.map((d) => (d.id === id ? { id, ...deal } : d)));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Pipeline
        </h1>
        <Button size="lg" onClick={() => setAddOpen(true)}>
          <PlusIcon />
          Deal
        </Button>
      </div>

      <DndProvider backend={HTML5Backend}>
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((column) => (
            <PipelineColumn
              key={column.stage}
              column={column}
              deals={deals.filter((d) => d.stage === column.stage)}
              onDropDeal={handleDropDeal}
              onOpenDeal={handleOpenDeal}
            />
          ))}
        </div>
      </DndProvider>

      <DealModal
        mode="add"
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddDeal}
      />

      <DealModal
        mode="edit"
        open={editing !== null}
        deal={editing}
        onClose={() => setEditing(null)}
        onSubmit={handleSaveDeal}
      />
    </div>
  );
}
