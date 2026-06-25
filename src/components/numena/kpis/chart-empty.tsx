import { cn } from "@/lib/utils";

/**
 * Placeholder shown inside a KPI card while no data has been wired yet. The
 * card keeps its chrome (title, controls) so the layout still reads as a real
 * chart; only the plot area shows this message.
 */
export function ChartEmpty({
  className,
  message = "Awaiting data",
}: {
  className?: string;
  message?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1 text-center",
        className
      )}
    >
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/70">
        Connect the Numena data source to populate this view.
      </p>
    </div>
  );
}
