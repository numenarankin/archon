"use client";

import { useCallback, useState } from "react";
import { PlusIcon } from "lucide-react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "@/components/ui/button";
import { PipelineColumn } from "@/components/numena/pipeline-column";
import { DealModal, type NewDeal } from "@/components/numena/deal-modal";
import type {
  BusinessUnitKey,
  Deal,
  PipelineStage,
} from "@/lib/numena/pipeline";
import { createDeal, moveDeal, updateDeal } from "@/lib/numena/deal-actions";

/**
 * Sales pipeline kanban, backed by the CRM. Drag a deal between stage columns to
 * persist its stage (and open/won/lost status); add and edit deals via the
 * modal. Updates are optimistic and saved through server actions.
 */
export function PipelineBoard({
  stages,
  deals: initial,
  buKey,
}: {
  stages: PipelineStage[];
  deals: Deal[];
  buKey: BusinessUnitKey;
}) {
  const [deals, setDeals] = useState<Deal[]>(initial);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);

  // Drag → persist the new stage. Optimistic; reverts on failure.
  const handleDropDeal = useCallback((dealId: string, stageId: string) => {
    let prevStage: string | undefined;
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d;
        prevStage = d.stageId;
        return { ...d, stageId };
      })
    );
    moveDeal(dealId, stageId).catch((e) => {
      console.error("Failed to move deal", e);
      if (prevStage)
        setDeals((prev) =>
          prev.map((d) => (d.id === dealId ? { ...d, stageId: prevStage! } : d))
        );
    });
  }, []);

  const handleOpenDeal = useCallback((deal: Deal) => setEditing(deal), []);

  async function handleAddDeal(deal: NewDeal) {
    const tempId = `temp-${Date.now()}`;
    setDeals((prev) => [{ id: tempId, ...deal }, ...prev]);
    try {
      const { id } = await createDeal(buKey, deal);
      setDeals((prev) => prev.map((d) => (d.id === tempId ? { ...d, id } : d)));
    } catch (e) {
      console.error("Failed to create deal", e);
      setDeals((prev) => prev.filter((d) => d.id !== tempId));
    }
  }

  async function handleSaveDeal(deal: NewDeal) {
    if (!editing) return;
    const id = editing.id;
    const prev = editing;
    setDeals((cur) => cur.map((d) => (d.id === id ? { id, ...deal } : d)));
    try {
      await updateDeal(id, deal);
    } catch (e) {
      console.error("Failed to save deal", e);
      setDeals((cur) => cur.map((d) => (d.id === id ? prev : d)));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Pipeline
        </h1>
        <Button
          size="lg"
          disabled={stages.length === 0}
          onClick={() => setAddOpen(true)}
        >
          <PlusIcon />
          Deal
        </Button>
      </div>

      {stages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No pipeline configured for this business unit yet.
        </div>
      ) : (
        <DndProvider backend={HTML5Backend}>
          <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
            {stages.map((column) => (
              <PipelineColumn
                key={column.id}
                column={column}
                deals={deals.filter((d) => d.stageId === column.id)}
                onDropDeal={handleDropDeal}
                onOpenDeal={handleOpenDeal}
              />
            ))}
          </div>
        </DndProvider>
      )}

      <DealModal
        mode="add"
        open={addOpen}
        stages={stages}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddDeal}
      />

      <DealModal
        mode="edit"
        open={editing !== null}
        stages={stages}
        deal={editing}
        onClose={() => setEditing(null)}
        onSubmit={handleSaveDeal}
      />
    </div>
  );
}
