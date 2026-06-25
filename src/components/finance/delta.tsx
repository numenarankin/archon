"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

interface DeltaProps {
  value: number; // already a percent, e.g. 12.4 = +12.4%
  className?: string;
  precision?: number;
  suffix?: string;
}

export function Delta({
  value,
  className,
  precision = 1,
  suffix = "%",
}: DeltaProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        isPositive && "text-emerald-600 dark:text-emerald-400",
        isNegative && "text-destructive",
        !isPositive && !isNegative && "text-muted-foreground",
        className
      )}
    >
      <Icon className="size-3 shrink-0" strokeWidth={2} />
      {Math.abs(value).toFixed(precision)}
      {suffix}
    </span>
  );
}
