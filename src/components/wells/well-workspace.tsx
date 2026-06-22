"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, UploadIcon, SettingsIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WellInfoDialog,
  type WellInfo,
} from "@/components/wells/well-info-dialog";
import {
  addProduction,
  addWellEquipmentRow,
  addWellRoyaltyOwner,
  deleteProduction,
  deleteWellEquipment,
  removeWellRoyaltyOwner,
  seedWellEquipmentTemplate,
  updateProduction,
  updateWell,
  updateWellEquipment,
  updateWellRoyaltyOwner,
  uploadWellFile,
} from "@/lib/wells/actions";
import { getDownloadUrl } from "@/lib/files/actions";
import { useAiContext } from "@/lib/ai/use-ai-context";
import { cn } from "@/lib/utils";
import { ProductionChart } from "@/components/wells/production-chart";
import { ProductionTable } from "@/components/wells/production-table";
import { WellComments } from "@/components/wells/well-comments";
import { WellEquipmentPanel } from "@/components/wells/well-equipment";
import {
  WellFilesPanel,
  type WellFileUpload,
} from "@/components/wells/well-files";
import { WellFileViewer } from "@/components/wells/well-file-viewer";
import { AddDataModal } from "@/components/wells/add-data-modal";
import { EditDataModal } from "@/components/wells/edit-data-modal";
import {
  WellRoyaltyOwnersPanel,
  type RoyaltyOwnerEdit,
} from "@/components/wells/well-royalty-owners";
import type { RoyaltyOwner } from "@/lib/people/people";
import type {
  ProductionPoint,
  Well,
  WellComment,
  WellEquipment,
  WellFile,
} from "@/lib/wells/wells";

type WorkspaceTab =
  | "production"
  | "comments"
  | "equipment"
  | "files"
  | "royalty-owners";

const TABS: { value: WorkspaceTab; label: string }[] = [
  { value: "production", label: "Production" },
  { value: "comments", label: "Comments" },
  { value: "equipment", label: "Equipment" },
  { value: "files", label: "Files" },
  { value: "royalty-owners", label: "Royalty Owners" },
];

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-1 pb-3 text-lg font-semibold transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function WellWorkspace({
  well,
  production: initialProduction,
  comments,
  equipment: initialEquipment,
  files: initialFiles,
  royaltyOwners: initialRoyaltyOwners,
  currentUser,
}: {
  well: Well;
  production: ProductionPoint[];
  comments: WellComment[];
  equipment: WellEquipment[];
  files: WellFile[];
  royaltyOwners: RoyaltyOwner[];
  /** Unused here, but the page still supplies it for the well-name map. */
  wellNameById: Record<string, string>;
  /** Signed-in user's display name + initials, for optimistic comment posting. */
  currentUser: { name: string; initials: string };
}) {
  const router = useRouter();
  const setAiSelection = useAiContext((s) => s.setSelection);
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<WorkspaceTab>("production");
  const [production, setProduction] = useState(initialProduction);
  const [equipment, setEquipment] = useState(initialEquipment);
  const [files, setFiles] = useState(initialFiles);
  const [uploads, setUploads] = useState<WellFileUpload[]>([]);
  const [viewingFile, setViewingFile] = useState<WellFile | null>(null);
  const [owners, setOwners] = useState(initialRoyaltyOwners);
  const [addDataOpen, setAddDataOpen] = useState(false);
  const [editPoint, setEditPoint] = useState<ProductionPoint | null>(null);
  const [equipmentFocusId, setEquipmentFocusId] = useState<string | null>(null);
  const [royaltyFocusId, setRoyaltyFocusId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [wellInfo, setWellInfo] = useState<WellInfo>({
    name: well.name,
    formation: well.zone,
    county: well.county,
    depth: well.depth,
    perforations: well.perforations,
    dateDrilled: well.dateDrilled,
    coordinates: well.coordinates,
    oilBblPerInch: well.oilBblPerInch,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Keep the raw File around per upload so a failed attempt can be retried.
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  // Seed the standard equipment template once for a well that has none yet.
  const seededEquipmentRef = useRef(false);

  useEffect(() => {
    if (seededEquipmentRef.current || equipment.length > 0) return;
    seededEquipmentRef.current = true;
    seedWellEquipmentTemplate(well.id)
      .then((rows) => setEquipment(rows))
      .catch((error) =>
        console.error("Failed to seed equipment template", error)
      );
  }, [equipment.length, well.id]);

  // Tell the Archon drawer (and voice loop) which well is open, so "this well" /
  // an unnamed well question resolves to this one. Cleared on unmount.
  useEffect(() => {
    setAiSelection({ kind: "well", id: well.id, name: well.name });
    return () => setAiSelection(null);
  }, [well.id, well.name, setAiSelection]);

  function handleSaveInfo(info: WellInfo) {
    setWellInfo(info); // optimistic update for the header
    startTransition(async () => {
      try {
        await updateWell(well.id, info);
        router.refresh();
      } catch (error) {
        console.error("Failed to update well", error);
      }
    });
  }

  function sortByTimestamp(points: ProductionPoint[]): ProductionPoint[] {
    // Chronological order (oldest first) so the chart reads left → right.
    return [...points].sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
    );
  }

  function handleAddData(point: ProductionPoint) {
    setProduction((prev) => sortByTimestamp([...prev, point]));
    setTab("production");
    startTransition(async () => {
      try {
        const { id } = await addProduction(well.id, point);
        // Backfill the real row id so the new row can be edited/deleted before
        // the next full refresh.
        setProduction((prev) =>
          prev.map((p) => (p === point ? { ...p, id } : p))
        );
      } catch (error) {
        console.error("Failed to add production", error);
      }
    });
  }

  function handleUpdateData(updated: ProductionPoint) {
    setProduction((prev) =>
      sortByTimestamp(
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      )
    );
    setTab("production");
    if (!updated.id) return;
    startTransition(async () => {
      try {
        await updateProduction(well.id, updated.id as string, updated);
      } catch (error) {
        console.error("Failed to update production", error);
      }
    });
  }

  function handleDeleteData(point: ProductionPoint) {
    setProduction((prev) => prev.filter((p) => p.id !== point.id));
    setTab("production");
    if (!point.id) return;
    startTransition(async () => {
      try {
        await deleteProduction(well.id, point.id as string);
      } catch (error) {
        console.error("Failed to delete production", error);
      }
    });
  }

  function handleEquipmentChange(
    id: string,
    patch: { label?: string; value?: string }
  ) {
    // Local, per-keystroke update; persisted on commit (blur / Enter).
    setEquipment((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function handleEquipmentCommit(id: string) {
    const row = equipment.find((item) => item.id === id);
    if (!row) return;
    startTransition(async () => {
      try {
        await updateWellEquipment(well.id, id, {
          label: row.label,
          value: row.value,
        });
      } catch (error) {
        console.error("Failed to update equipment", error);
      }
    });
  }

  function handleEquipmentAdd() {
    startTransition(async () => {
      try {
        const row = await addWellEquipmentRow(well.id);
        setEquipment((prev) => [...prev, row]);
        setEquipmentFocusId(row.id); // focus the new row's field input
      } catch (error) {
        console.error("Failed to add equipment row", error);
      }
    });
  }

  function handleEquipmentDelete(id: string) {
    setEquipment((prev) => prev.filter((item) => item.id !== id));
    startTransition(async () => {
      try {
        await deleteWellEquipment(well.id, id);
      } catch (error) {
        console.error("Failed to delete equipment", error);
      }
    });
  }

  function handleOwnerChange(id: string, patch: RoyaltyOwnerEdit) {
    // Local, per-keystroke update; persisted on commit (blur / Enter / select).
    setOwners((prev) =>
      prev.map((owner) => (owner.id === id ? { ...owner, ...patch } : owner))
    );
  }

  function handleOwnerCommit(id: string) {
    const row = owners.find((owner) => owner.id === id);
    if (!row) return;
    startTransition(async () => {
      try {
        await updateWellRoyaltyOwner(well.id, id, {
          name: row.name,
          interestType: row.interestType,
          decimalInterest: row.decimalInterest,
          lastPayment: row.lastPayment,
          email: row.email,
          mailingAddress: row.mailingAddress,
        });
      } catch (error) {
        console.error("Failed to update royalty owner", error);
      }
    });
  }

  function handleOwnerAdd() {
    startTransition(async () => {
      try {
        const row = await addWellRoyaltyOwner(well.id);
        setOwners((prev) => [...prev, row]);
        setRoyaltyFocusId(row.id); // focus the new row's name input
      } catch (error) {
        console.error("Failed to add royalty owner", error);
      }
    });
  }

  function handleOwnerDelete(id: string) {
    setOwners((prev) => prev.filter((owner) => owner.id !== id));
    startTransition(async () => {
      try {
        await removeWellRoyaltyOwner(well.id, id);
      } catch (error) {
        console.error("Failed to remove royalty owner", error);
      }
    });
  }

  /** Upload one file, tracking its status from "uploading" → done / error. */
  async function startUpload(file: File, key: string) {
    pendingFilesRef.current.set(key, file);
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    setUploads((prev) => {
      const next: WellFileUpload = {
        key,
        name: file.name,
        sizeKb,
        status: "uploading",
      };
      return prev.some((u) => u.key === key)
        ? prev.map((u) => (u.key === key ? next : u))
        : [...prev, next];
    });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const created = await uploadWellFile(well.id, formData);
      // Promote the finished upload into the real file list.
      setFiles((prev) => [created, ...prev]);
      setUploads((prev) => prev.filter((u) => u.key !== key));
      pendingFilesRef.current.delete(key);
    } catch (error) {
      setUploads((prev) =>
        prev.map((u) =>
          u.key === key
            ? {
                ...u,
                status: "error",
                error:
                  error instanceof Error
                    ? error.message
                    : "Upload failed. Please try again.",
              }
            : u
        )
      );
    }
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length > 0) {
      setTab("files");
      selected.forEach((file, index) => {
        const key = `${Date.now()}-${index}-${file.name}`;
        void startUpload(file, key);
      });
    }
    // Allow selecting the same file again.
    event.target.value = "";
  }

  function handleRetryUpload(key: string) {
    const file = pendingFilesRef.current.get(key);
    if (file) void startUpload(file, key);
  }

  function handleDismissUpload(key: string) {
    setUploads((prev) => prev.filter((u) => u.key !== key));
    pendingFilesRef.current.delete(key);
  }

  async function handleDownload(file: WellFile) {
    try {
      const url = await getDownloadUrl(file.id);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to get download URL", error);
    }
  }

  const uploading = uploads.some((u) => u.status === "uploading");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {wellInfo.name}
            </h1>
            <button
              type="button"
              aria-label="Well info"
              onClick={() => setInfoOpen(true)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <SettingsIcon className="size-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {wellInfo.formation} · {well.county} County ·{" "}
            {wellInfo.perforations} ft
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <UploadIcon />
            )}
            {uploading ? "Uploading…" : "Upload File"}
          </Button>
          <Button
            size="lg"
            onClick={() => setAddDataOpen(true)}
            className="bg-black text-white hover:bg-neutral-800"
          >
            <PlusIcon />
            Production
          </Button>
        </div>
      </div>

      <ProductionChart data={production} />

      <div className="flex flex-col">
        <div role="tablist" className="flex items-center gap-6 border-b">
          {TABS.map((t) => (
            <TabButton
              key={t.value}
              active={tab === t.value}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </TabButton>
          ))}
        </div>

        <div className="pt-4">
          <div className={cn(tab !== "production" && "hidden")}>
            <ProductionTable data={production} onRowClick={setEditPoint} />
          </div>
          <div className={cn(tab !== "comments" && "hidden")}>
            <WellComments
              wellId={well.id}
              comments={comments}
              currentUser={currentUser}
            />
          </div>
          <div className={cn(tab !== "equipment" && "hidden")}>
            <WellEquipmentPanel
              equipment={equipment}
              onChange={handleEquipmentChange}
              onCommit={handleEquipmentCommit}
              onAdd={handleEquipmentAdd}
              onDelete={handleEquipmentDelete}
              autoFocusId={equipmentFocusId}
            />
          </div>
          <div className={cn(tab !== "files" && "hidden")}>
            <WellFilesPanel
              files={files}
              uploads={uploads}
              onRetry={handleRetryUpload}
              onDismiss={handleDismissUpload}
              onDownload={handleDownload}
              onView={setViewingFile}
            />
          </div>
          <div className={cn(tab !== "royalty-owners" && "hidden")}>
            <WellRoyaltyOwnersPanel
              owners={owners}
              onChange={handleOwnerChange}
              onCommit={handleOwnerCommit}
              onAdd={handleOwnerAdd}
              onDelete={handleOwnerDelete}
              autoFocusId={royaltyFocusId}
            />
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      <AddDataModal
        open={addDataOpen}
        onClose={() => setAddDataOpen(false)}
        onSubmit={handleAddData}
      />
      <EditDataModal
        open={editPoint !== null}
        point={editPoint}
        oilBblPerInch={wellInfo.oilBblPerInch}
        onClose={() => setEditPoint(null)}
        onSave={handleUpdateData}
        onDelete={handleDeleteData}
      />
      <WellInfoDialog
        open={infoOpen}
        onOpenChange={setInfoOpen}
        info={wellInfo}
        onSave={handleSaveInfo}
      />
      <WellFileViewer
        file={viewingFile}
        onClose={() => setViewingFile(null)}
      />
    </div>
  );
}
