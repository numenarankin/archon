"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDownloadUrl } from "@/lib/files/actions";
import type { RepoFile } from "@/lib/kb/types";

// react-pdf (inside FilePreview) touches browser-only globals (DOMMatrix) at
// module eval, which breaks server prerender — load it client-side only.
const FilePreview = dynamic(
  () => import("@/components/files/file-preview").then((m) => m.FilePreview),
  { ssr: false }
);

/** Types we render with the real embedded viewer (PDFs, images, LAS logs). */
function isPreviewable(type: string, name: string): boolean {
  return (
    type === "pdf" ||
    type === "image" ||
    type === "las" ||
    /\.las$/i.test(name)
  );
}

/**
 * In-app document viewer. PDFs and images render in the real embedded viewer
 * (zoom / rotate / paging, shared with projects) loaded from the
 * file's signed URL. Other types fall back to a placeholder rendering until a
 * storage-backed preview exists.
 */
export function DocumentViewer({
  file,
  name,
  onBack,
}: {
  file: RepoFile;
  name: string;
  onBack: () => void;
}) {
  const previewable = isPreviewable(file.type, name);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(previewable);

  // Fetch the signed URL for PDFs / images.
  useEffect(() => {
    if (!previewable) return;
    let active = true;
    getDownloadUrl(file.id)
      .then((signed) => {
        if (!active) return;
        setUrl(signed);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load file", error);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [file.id, previewable]);

  const placeholder = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8"><style>
        body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;padding:48px;color:#1a1a1a;background:#fff;line-height:1.6}
        .tag{display:inline-block;font:600 11px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;color:#666;border:1px solid #ddd;border-radius:999px;padding:2px 10px}
        h1{font-size:24px;margin:16px 0 4px}
        p{color:#555;max-width:60ch}
      </style></head><body>
        <span class="tag">${file.type}</span>
        <h1>${name}</h1>
        <p>Embedded preview of <strong>${name}</strong> (${file.size}, modified ${file.modified}).</p>
        <p>This is a placeholder rendering for the prototype. With a real storage
        backend the document URL would load here directly in the iframe.</p>
      </body></html>`,
    [file.size, file.type, file.modified, name]
  );

  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    if (previewable) return;
    const blob = new Blob([placeholder], { type: "text/html" });
    const objectUrl = URL.createObjectURL(blob);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [placeholder, previewable]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon-sm" aria-label="Back" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {name}
        </h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-white">
        {previewable ? (
          loading ? (
            <div className="flex flex-1 items-center justify-center text-tertiary-text">
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          ) : url ? (
            <FilePreview url={url} type={file.type} name={name} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-tertiary-text">
              No preview available for this file.
            </div>
          )
        ) : (
          <iframe
            src={src}
            title={name}
            className="h-full w-full"
            // Sandbox the embedded document; allow same-origin so blob URLs render.
            sandbox="allow-same-origin"
          />
        )}
      </div>
    </div>
  );
}
