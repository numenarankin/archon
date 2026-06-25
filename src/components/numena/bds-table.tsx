import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/people/status-badge";
import type { BusinessDeveloper } from "@/lib/numena/prospecting";

export function BdsTable({ bds }: { bds: BusinessDeveloper[] }) {
  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bds.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                No business developers to display.
              </TableCell>
            </TableRow>
          ) : (
            bds.map((b) => (
              <TableRow key={b.id} className="[&>td]:py-4">
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {b.company}
                </TableCell>
                <TableCell className="text-muted-foreground">{b.region}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {b.phone}
                </TableCell>
                <TableCell className="text-muted-foreground">{b.email}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <StatusBadge status={b.status} />
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
