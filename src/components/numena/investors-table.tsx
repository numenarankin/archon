import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/people/status-badge";
import type { Investor } from "@/lib/numena/prospecting";

export function InvestorsTable({ investors }: { investors: Investor[] }) {
  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Firm</TableHead>
            <TableHead>Focus</TableHead>
            <TableHead>Commitment</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {investors.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                No investors to display.
              </TableCell>
            </TableRow>
          ) : (
            investors.map((i) => (
              <TableRow key={i.id} className="[&>td]:py-4">
                <TableCell className="font-medium">{i.name}</TableCell>
                <TableCell className="text-muted-foreground">{i.firm}</TableCell>
                <TableCell className="text-muted-foreground">{i.focus}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {i.commitment}
                </TableCell>
                <TableCell className="text-muted-foreground">{i.email}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <StatusBadge status={i.status} />
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
