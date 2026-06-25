"use client";

import type { Ref } from "react";
import { useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import {
  DealCard,
  DEAL_DND_TYPE,
  type DealDragItem,
} from "@/components/numena/deal-card";
import type { Deal, PipelineStageDef } from "@/lib/numena/pipeline";

const totalFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function PipelineColumn({
  column,
  deals,
  onDropDeal,
  onOpenDeal,
}: {
  column: PipelineStageDef;
  deals: Deal[];
  onDropDeal: (dealId: string, stage: PipelineStageDef["stage"]) => void;
  onOpenDeal: (deal: Deal) => void;
}) {
  const [{ isOver }, dropRef] = useDrop<
    DealDragItem,
    unknown,
    { isOver: boolean }
  >(
    () => ({
      accept: DEAL_DND_TYPE,
      drop: (item) => onDropDeal(item.id, column.stage),
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [column.stage, onDropDeal]
  );

  const total = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex min-h-0 w-72 shrink-0 flex-col rounded-xl bg-muted/40">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">
          {column.label}
        </span>
        <span className="rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
          {deals.length}
        </span>
        <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
          {totalFormatter.format(total)}
        </span>
      </div>
      <div
        ref={dropRef as unknown as Ref<HTMLDivElement>}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-2 transition-colors",
          isOver && "bg-foreground/5 ring-1 ring-inset ring-foreground/15"
        )}
      >
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onOpen={onOpenDeal} />
        ))}
        {deals.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground/70">No deals</p>
        )}
      </div>
    </div>
  );
}
