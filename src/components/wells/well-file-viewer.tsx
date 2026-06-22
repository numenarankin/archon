"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2Icon } from "lucide-react";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { getDownloadUrl } from "@/lib/files/actions";
import type { WellFile } from "@/lib/wells/wells";

// react-pdf (inside FilePreview) touches browser-only globals at module eval,
// which breaks server prerender — load it client-side only.
const FilePreview = dynamic(
  () => import("@/components/files/file-preview").then((m) => m.FilePreview),
  { ssr: false }
);

type PreviewKind = "pdf" | "image" | "las" | "other";

/** Map a well file's type (and name) to a viewer kind. */
function previewKind(wellType: string, name: string): PreviewKind {
  const t = wellType.toLowerCase();
  if (t === "pdf") return "pdf";
  if (["image", "png", "jpg", "jpeg", "gif", "webp", "svg"].includes(t)) {
    return "image";
  }
  // LAS files were uploaded as `doc` before the type existed — detect by name.
  if (t === "las" || /\.las$/i.test(name)) return "las";
  return "other";
}

interface WellFileViewerProps {
  /** The file to view, or null when the modal is closed. */
  file: WellFile | null;
  onClose: () => void;
}

/**
 * Click-to-view document modal for a well's files. Resolves a short-lived
 * signed URL and renders it in the shared embedded viewer (PDF paging/zoom or
 * image), scrollable to read the whole document. Other types fall back to an
 * iframe of the signed URL.
 */
export function WellFileViewer({ file, onClose }: WellFileViewerProps) {
  // Keep the last file visible through the close animation so the modal doesn't
  // flash empty as it slides away.
  const [shown, setShown] = useState<WellFile | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (file) setShown(file);
  }, [file]);

  useEffect(() => {
    if (!shown) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    setUrl(null);
    getDownloadUrl(shown.id)
      .then((signed) => {
        if (!active) return;
        setUrl(signed);
        setFailed(!signed);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load file", error);
        if (!active) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [shown]);

  const name = shown?.name ?? "Document";
  const kind = shown ? previewKind(shown.type, shown.name) : "other";

  return (
    <SwipeUpModal
      open={file !== null}
      onClose={onClose}
      title={name}
      className="h-[88vh] max-w-5xl"
    >
      <div className="flex min-h-0 flex-1 flex-col bg-neutral-100">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-tertiary-text">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        ) : url && kind !== "other" ? (
          <FilePreview url={url} type={kind} name={name} />
        ) : url ? (
          <iframe src={url} title={name} className="h-full w-full border-0" />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-tertiary-text">
            {failed
              ? "Couldn't load this document."
              : "No preview available for this file."}
          </div>
        )}
      </div>
    </SwipeUpModal>
  );
}
