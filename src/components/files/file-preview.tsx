"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ZoomInIcon,
  ZoomOutIcon,
  RotateCwIcon,
  Loader2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LasPreview } from "@/components/files/las-preview";

// Use the worker shipped with the installed pdfjs-dist (version-matched).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const STEP = 0.2;
const clampScale = (n: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));

interface FilePreviewProps {
  url: string;
  type: string;
  name: string;
}

/** Embedded viewer with custom zoom controls for PDFs and images. */
export function FilePreview({ url, type, name }: FilePreviewProps) {
  if (type === "pdf") return <PdfPreview url={url} />;
  if (type === "image") return <ImagePreview url={url} name={name} />;
  // LAS well logs: route by explicit type OR filename, so files stored before
  // the `las` type existed (saved as `doc`) still get the log viewer.
  if (type === "las" || /\.las$/i.test(name)) {
    // Key by url so switching files remounts fresh (no stale-log flash).
    return <LasPreview key={url} url={url} name={name} />;
  }
  return <iframe src={url} title={name} className="h-full w-full border-0" />;
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border bg-background-surface px-2 py-1.5">
      {children}
    </div>
  );
}

function ZoomControls({
  scale,
  setScale,
}: {
  scale: number;
  setScale: (updater: (n: number) => number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom out"
        disabled={scale <= MIN_SCALE}
        onClick={() => setScale((s) => clampScale(s - STEP))}
      >
        <ZoomOutIcon />
      </Button>
      <button
        type="button"
        title="Reset zoom"
        onClick={() => setScale(() => 1)}
        className="ty-caption w-11 rounded px-1 py-0.5 text-center font-mono text-tertiary-text hover:bg-background-subtle"
      >
        {Math.round(scale * 100)}%
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom in"
        disabled={scale >= MAX_SCALE}
        onClick={() => setScale((s) => clampScale(s + STEP))}
      >
        <ZoomInIcon />
      </Button>
    </div>
  );
}

function RotateButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Rotate" onClick={onClick}>
      <RotateCwIcon />
    </Button>
  );
}

function PdfPreview({ url }: { url: string }) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar>
        <span className="ty-caption font-mono text-tertiary-text">
          {numPages ? `${numPages} ${numPages === 1 ? "page" : "pages"}` : "…"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <RotateButton onClick={() => setRotation((r) => (r + 90) % 360)} />
          <ZoomControls scale={scale} setScale={setScale} />
        </div>
      </Toolbar>

      {/* All pages stacked — scroll to move between them. */}
      <div className="min-h-0 flex-1 overflow-auto bg-neutral-100 p-4">
        <div className="mx-auto w-fit">
          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<Loading />}
            error={<Centered>Couldn&apos;t load this PDF.</Centered>}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page
                key={i + 1}
                pageNumber={i + 1}
                scale={scale}
                rotate={rotation}
                className="mb-4 shadow-sm last:mb-0"
              />
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
}

function ImagePreview({ url, name }: { url: string; name: string }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar>
        <span className="ty-caption truncate px-1 text-tertiary-text">
          {name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <RotateButton onClick={() => setRotation((r) => (r + 90) % 360)} />
          <ZoomControls scale={scale} setScale={setScale} />
        </div>
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-auto bg-neutral-100 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          style={{
            width: `${scale * 100}%`,
            maxWidth: scale <= 1 ? "100%" : "none",
            transform: `rotate(${rotation}deg)`,
          }}
          className="mx-auto h-auto"
        />
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center p-8 text-tertiary-text">
      <Loader2Icon className="size-5 animate-spin" />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="ty-body-2 flex items-center justify-center p-8 text-tertiary-text">
      {children}
    </div>
  );
}
