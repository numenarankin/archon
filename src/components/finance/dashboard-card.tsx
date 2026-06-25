import type * as React from "react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/** A full-height card used across the finance dashboard grid. */
export function DashboardCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return <Card className={cn("h-full rounded-[0.1rem]", className)} {...props} />;
}
