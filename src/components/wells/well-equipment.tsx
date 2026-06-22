"use client";

import { PlusIcon, WrenchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WellEquipment } from "@/lib/wells/wells";

const CELL_INPUT =
  "w-full rounded bg-transparent px-1.5 py-1 outline-none placeholder:text-muted-foreground/50 focus:bg-muted focus:ring-1 focus:ring-ring";

interface WellEquipmentPanelProps {
  equipment: WellEquipment[];
  /** Local edit of a field's label/value (controlled input). */
  onChange: (id: string, patch: { label?: string; value?: string }) => void;
  /** Persist a row after an edit (fired on blur / Enter). */
  onCommit: (id: string) => void;
  /** Append a new blank row. */
  onAdd: () => void;
  /** Remove a row. */
  onDelete: (id: string) => void;
  /** Row whose label input should grab focus (e.g. a freshly added row). */
  autoFocusId?: string | null;
}

export function WellEquipmentPanel({
  equipment,
  onChange,
  onCommit,
  onAdd,
  onDelete,
  autoFocusId,
}: WellEquipmentPanelProps) {
  // Enter commits the value by blurring; the blur handler does the persist.
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-[0.1rem] border">
        <Table className="text-[0.95rem]">
          <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-1/3">Field</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  No equipment recorded for this well.
                </TableCell>
              </TableRow>
            ) : (
              equipment.map((item) => (
                <TableRow key={item.id} className="group [&>td]:py-2">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <WrenchIcon className="size-4 shrink-0 text-muted-foreground" />
                      <input
                        value={item.label}
                        placeholder="Field name"
                        autoFocus={autoFocusId === item.id}
                        onChange={(e) =>
                          onChange(item.id, { label: e.target.value })
                        }
                        onBlur={() => onCommit(item.id)}
                        onKeyDown={handleKeyDown}
                        className={`${CELL_INPUT} font-medium`}
                        aria-label="Field name"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <input
                      value={item.value}
                      placeholder="—"
                      onChange={(e) =>
                        onChange(item.id, { value: e.target.value })
                      }
                      onBlur={() => onCommit(item.id)}
                      onKeyDown={handleKeyDown}
                      className={`${CELL_INPUT} text-muted-foreground focus:text-foreground`}
                      aria-label={`${item.label || "Field"} value`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${item.label || "field"}`}
                      onClick={() => onDelete(item.id)}
                      className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <XIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={onAdd}
      >
        <PlusIcon />
        Add Equipment
      </Button>
    </div>
  );
}
