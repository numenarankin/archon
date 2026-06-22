import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/people/status-badge";
import type { Contractor } from "@/lib/people/people";

export function ContractorsTable({
  contractors,
  onRowClick,
}: {
  contractors: Contractor[];
  onRowClick?: (contractor: Contractor) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Trade</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contractors.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                No contractors to display.
              </TableCell>
            </TableRow>
          ) : (
            contractors.map((c) => (
              <TableRow
                key={c.id}
                onClick={() => onRowClick?.(c)}
                className="cursor-pointer [&>td]:py-4"
              >
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.company}</TableCell>
                <TableCell className="text-muted-foreground">{c.trade}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {c.phone}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.email}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <StatusBadge status={c.status} />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
