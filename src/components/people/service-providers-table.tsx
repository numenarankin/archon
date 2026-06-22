import { Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/people/status-badge";
import type { ServiceProvider } from "@/lib/people/people";

/**
 * Groups providers by their service category and returns the groups in
 * alphabetical order of category, with each group's providers sorted by
 * company name.
 */
function groupByService(
  providers: ServiceProvider[]
): { service: string; items: ServiceProvider[] }[] {
  const groups = new Map<string, ServiceProvider[]>();
  for (const provider of providers) {
    groups.set(provider.service, [
      ...(groups.get(provider.service) ?? []),
      provider,
    ]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([service, items]) => ({
      service,
      items: [...items].sort((a, b) => a.company.localeCompare(b.company)),
    }));
}

export function ServiceProvidersTable({
  providers,
  onRowClick,
}: {
  providers: ServiceProvider[];
  onRowClick?: (provider: ServiceProvider) => void;
}) {
  const groups = groupByService(providers);

  return (
    <div className="overflow-hidden rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                No service providers to display.
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => (
              <Fragment key={group.service}>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell
                    colSpan={5}
                    className="py-2 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {group.service}
                  </TableCell>
                </TableRow>
                {group.items.map((p) => (
                  <TableRow
                    key={p.id}
                    onClick={() => onRowClick?.(p)}
                    className="cursor-pointer [&>td]:py-4"
                  >
                    <TableCell className="font-medium">{p.company}</TableCell>
                    <TableCell>{p.contact}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {p.phone}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.email}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <StatusBadge status={p.status} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
