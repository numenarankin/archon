"use client";

// Renders an email's HTML body safely in a sandboxed iframe. The sandbox has NO
// allow-scripts, so any <script> in the email is inert (XSS-safe) and the
// email's CSS can't leak into the app. allow-same-origin lets us measure the
// content height from the parent; allow-popups lets links open in a new tab.
import { useEffect, useRef, useState } from "react";

const SANDBOX = "allow-same-origin allow-popups allow-popups-to-escape-sandbox";

function wrap(html: string): string {
  // <base target="_blank"> so links open outside the iframe; a little reset so
  // emails that assume a white page body render sanely on our background.
  return `<!doctype html><html><head><meta charset="utf-8">
<base target="_blank">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;padding:0;background:#fff;color:#0f172a;
    font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;
    font-size:14px;line-height:1.5;word-break:break-word;}
  img{max-width:100%;height:auto;}
  a{color:#2563eb;}
  table{max-width:100%;}
</style></head><body>${html}</body></html>`;
}

export function EmailHtmlFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(320);

  // Measure the content and keep watching it: images and web fonts load after
  // onLoad and change the height, so we observe the body rather than measure
  // once. Set up here (on load) because the iframe document isn't ready before.
  const onLoad = () => {
    const doc = ref.current?.contentDocument;
    if (!doc?.body) return;
    const measure = () => {
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      if (h > 0) setHeight(h + 8);
    };
    measure();
    observerRef.current?.disconnect();
    observerRef.current = new ResizeObserver(measure);
    observerRef.current.observe(doc.body);
  };

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return (
    <iframe
      ref={ref}
      title="Email content"
      sandbox={SANDBOX}
      srcDoc={wrap(html)}
      onLoad={onLoad}
      className="w-full border-0 bg-white"
      style={{ height }}
    />
  );
}
