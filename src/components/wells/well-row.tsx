"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface WellRowProps {
  /** Destination route for this row. */
  href: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * A table row that navigates to `href` when clicked. Keyboard users can focus
 * the row and activate it with Enter or Space.
 */
export function WellRow({ href, className, children }: WellRowProps) {
  const router = useRouter();

  return (
    <TableRow
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(href);
        }
      }}
      onMouseEnter={() => router.prefetch(href)}
      className={cn(
        "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none",
        className
      )}
    >
      {children}
    </TableRow>
  );
}
