import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OnboardingStep } from "@/lib/numena/kpis-types";
import { ChartEmpty } from "./chart-empty";

const count = new Intl.NumberFormat("en-US");
const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

/**
 * The signup flow as a funnel: one bar per step scaled to the first step, with
 * the drop-off from the previous step called out so you can see where users
 * leave.
 */
export function OnboardingFunnel({ data }: { data: OnboardingStep[] }) {
  const top = data[0]?.entered ?? 0;
  const isEmpty = data.length === 0 || top === 0;

  return (
    <Card className="rounded-[0.1rem]">
      <CardHeader>
        <CardTitle>Onboarding Funnel</CardTitle>
        <CardDescription>
          Signup flow by step, with drop-off between stages
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-[280px]">
            <ChartEmpty className="h-full" />
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {data.map((s, i) => {
              const prev = i === 0 ? s.entered : data[i - 1].entered;
              const dropOff = prev > 0 ? 1 - s.entered / prev : 0;
              const width = top > 0 ? (s.entered / top) * 100 : 0;
              return (
                <li key={s.step} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{s.step}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {count.format(s.entered)}
                      {i > 0 && dropOff > 0
                        ? ` · ${pct.format(dropOff)} drop-off`
                        : ""}
                    </span>
                  </div>
                  <div className="h-6 w-full overflow-hidden rounded-sm bg-muted">
                    <div
                      className="h-full rounded-sm bg-[#4169e1]"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
