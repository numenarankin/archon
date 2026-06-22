import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { WellRow } from "@/components/wells/well-row";
import type { Well } from "@/lib/wells/wells";

const numberFormatter = new Intl.NumberFormat("en-US");

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const perBarrelFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function WellsTable({ wells }: { wells: Well[] }) {
  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Well Name</TableHead>
            <TableHead className="text-right">Depth (ft)</TableHead>
            <TableHead>Zone</TableHead>
            <TableHead>Perforations (ft)</TableHead>
            <TableHead>County</TableHead>
            <TableHead className="text-right">Oil (bbl/d)</TableHead>
            <TableHead className="text-right">Gas (MCF/d)</TableHead>
            <TableHead className="text-right">Salt Water</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Lifting Cost</TableHead>
            <TableHead className="text-right">P/L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {wells.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={11}
                className="h-24 text-center text-muted-foreground"
              >
                No wells to display.
              </TableCell>
            </TableRow>
          ) : (
            wells.map((well) => (
              <WellRow
                key={well.id}
                href={`/wells/${well.id}`}
                className="[&>td]:py-4"
              >
                <TableCell className="font-medium">{well.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(well.depth)}
                </TableCell>
                <TableCell>{well.zone}</TableCell>
                <TableCell className="tabular-nums">
                  {well.perforations}
                </TableCell>
                <TableCell>{well.county}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(well.oilProduction)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(well.gasProduction)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFormatter.format(well.saltWater)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currencyFormatter.format(well.revenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {perBarrelFormatter.format(well.liftingCost)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    well.pl < 0 ? "text-destructive" : "text-foreground"
                  )}
                >
                  {currencyFormatter.format(well.pl)}
                </TableCell>
              </WellRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
