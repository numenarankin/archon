import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RoyaltyOwner } from "@/lib/people/people";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Describes the well(s) an owner holds an interest in: the well name when there
 * is exactly one, "Multiple" when there are several, or a dash when none.
 */
function wellLabel(
  owner: RoyaltyOwner,
  wellNameById: Record<string, string>
): string {
  if (owner.wellIds.length === 0) {
    return "—";
  }
  if (owner.wellIds.length > 1) {
    return "Multiple";
  }
  const id = owner.wellIds[0];
  return wellNameById[id] ?? id;
}

export function RoyaltyOwnersTable({
  owners,
  wellNameById = {},
  onRowClick,
}: {
  owners: RoyaltyOwner[];
  wellNameById?: Record<string, string>;
  onRowClick?: (owner: RoyaltyOwner) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Interest Type</TableHead>
            <TableHead>Well</TableHead>
            <TableHead className="text-right">Decimal Interest</TableHead>
            <TableHead className="text-right">Last Payment</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Mailing Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {owners.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-24 text-center text-muted-foreground"
              >
                No royalty owners to display.
              </TableCell>
            </TableRow>
          ) : (
            owners.map((o) => (
              <TableRow
                key={o.id}
                onClick={() => onRowClick?.(o)}
                className="cursor-pointer [&>td]:py-4"
              >
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {o.interestType}
                </TableCell>
                <TableCell>{wellLabel(o, wellNameById)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {o.decimalInterest.toFixed(6)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currencyFormatter.format(o.lastPayment)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {o.email}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {o.mailingAddress}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
