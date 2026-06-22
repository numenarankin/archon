"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryModal } from "@/components/inventory/inventory-modal";
import {
  createInventoryItem,
  updateInventoryItem,
} from "@/lib/inventory/actions";
import type { InventoryItem } from "@/lib/inventory/inventory";

export function InventoryWorkspace({
  inventory: initialInventory,
}: {
  inventory: InventoryItem[];
}) {
  const router = useRouter();
  const [inventory, setInventory] = useState(initialInventory);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setInventory(initialInventory);
  }, [initialInventory]);

  function handleAddItem(item: Omit<InventoryItem, "id">) {
    setInventory((prev) => [{ id: `inv-local-${Date.now()}`, ...item }, ...prev]);
    startTransition(async () => {
      try {
        await createInventoryItem(item);
        router.refresh();
      } catch (error) {
        console.error("Failed to add inventory item", error);
      }
    });
  }

  function handleSaveItem(item: Omit<InventoryItem, "id">) {
    if (!editing) return;
    const id = editing.id;
    setInventory((prev) => prev.map((i) => (i.id === id ? { id, ...item } : i)));
    startTransition(async () => {
      try {
        await updateInventoryItem(id, item);
        router.refresh();
      } catch (error) {
        console.error("Failed to update inventory item", error);
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Inventory
        </h1>
        <Button size="lg" onClick={() => setAddOpen(true)}>
          <PlusIcon />
          Inventory
        </Button>
      </div>

      <InventoryTable items={inventory} onRowClick={setEditing} />

      <InventoryModal
        mode="add"
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddItem}
      />

      <InventoryModal
        mode="edit"
        open={editing !== null}
        item={editing}
        onClose={() => setEditing(null)}
        onSubmit={handleSaveItem}
      />
    </div>
  );
}
