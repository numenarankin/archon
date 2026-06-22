import { cn } from "@/lib/utils";
import type { InventoryStatus } from "@/lib/inventory/inventory";

const STATUS_STYLES: Record<InventoryStatus, string> = {
  "In Stock": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Low: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "On Order": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

export function StatusBadge({ status }: { status: InventoryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
