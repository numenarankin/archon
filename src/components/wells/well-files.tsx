import {
  AlertCircleIcon,
  DownloadIcon,
  FileTextIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WellFile } from "@/lib/wells/wells";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** A file being uploaded (or that failed) — surfaced as a status row. */
export interface WellFileUpload {
  /** Stable client-side key for this attempt. */
  key: string;
  name: string;
  sizeKb: number;
  status: "uploading" | "error";
  error?: string;
}

/** Formats a size in kilobytes as KB or MB. */
function formatSize(sizeKb: number): string {
  if (sizeKb >= 1024) {
    return `${(sizeKb / 1024).toFixed(1)} MB`;
  }
  return `${sizeKb} KB`;
}

/** Upper-cased extension, for the Type column on a pending row. */
function extOf(name: string): string {
  return name.split(".").pop()?.toUpperCase() || "FILE";
}

interface WellFilesPanelProps {
  files: WellFile[];
  uploads?: WellFileUpload[];
  onRetry?: (key: string) => void;
  onDismiss?: (key: string) => void;
  onDownload?: (file: WellFile) => void;
  /** Open the file in the embedded document viewer. */
  onView?: (file: WellFile) => void;
}

export function WellFilesPanel({
  files,
  uploads = [],
  onRetry,
  onDismiss,
  onDownload,
  onView,
}: WellFilesPanelProps) {
  const busy = uploads.some((u) => u.status === "uploading");
  const isEmpty = files.length === 0 && uploads.length === 0;

  return (
    <div
      className="overflow-hidden rounded-[0.1rem] border"
      aria-busy={busy}
      aria-live="polite"
    >
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Size</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="text-right">Download</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploads.map((upload) =>
            upload.status === "uploading" ? (
              <TableRow
                key={upload.key}
                className="[&>td]:py-4 hover:bg-transparent"
              >
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2.5">
                    <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    {upload.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {extOf(upload.name)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatSize(upload.sizeKb)}
                </TableCell>
                <TableCell colSpan={2} className="text-muted-foreground">
                  Uploading &amp; indexing…
                </TableCell>
              </TableRow>
            ) : (
              <TableRow
                key={upload.key}
                className="[&>td]:py-4 hover:bg-transparent"
              >
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2.5">
                    <AlertCircleIcon className="size-4 shrink-0 text-destructive" />
                    {upload.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {extOf(upload.name)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatSize(upload.sizeKb)}
                </TableCell>
                <TableCell colSpan={2}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-destructive">
                      {upload.error ?? "Upload failed."}
                    </span>
                    <span className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRetry?.(upload.key)}
                      >
                        Retry
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Dismiss ${upload.name}`}
                        onClick={() => onDismiss?.(upload.key)}
                      >
                        <XIcon />
                      </Button>
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )
          )}
          {isEmpty ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                No files attached to this well.
              </TableCell>
            </TableRow>
          ) : (
            files.map((file) => (
              <TableRow key={file.id} className="[&>td]:py-4">
                <TableCell className="font-medium">
                  <button
                    type="button"
                    onClick={() => onView?.(file)}
                    className="flex items-center gap-2.5 text-left transition-colors hover:text-foreground hover:underline"
                  >
                    <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                    {file.name}
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {file.type}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatSize(file.sizeKb)}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {dateFormatter.format(new Date(file.uploadedAt))}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Download ${file.name}`}
                    onClick={() => onDownload?.(file)}
                  >
                    <DownloadIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
