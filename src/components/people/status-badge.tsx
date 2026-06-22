import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "In Pay": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Inactive: "bg-muted text-muted-foreground",
  Suspended: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
