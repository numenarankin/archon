"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A bottom-anchored card that swipes up into a vertically-centered position
 * with GSAP, over a darkened + blurred backdrop. Rendered via a portal so the
 * fixed overlay escapes the page's query-container.
 */
export function SwipeUpModal({
  open,
  onClose,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!mounted) {
      return;
    }
    const backdrop = backdropRef.current;
    const card = cardRef.current;
    if (!backdrop || !card) {
      return;
    }

    if (open) {
      const tl = gsap.timeline();
      tl.fromTo(
        backdrop,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.3, ease: "power2.out" }
      ).fromTo(
        card,
        { yPercent: 100, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out" },
        "<"
      );
      return () => {
        tl.kill();
      };
    }

    const tl = gsap.timeline({ onComplete: () => setMounted(false) });
    tl.to(card, {
      yPercent: 100,
      autoAlpha: 0,
      duration: 0.35,
      ease: "power3.in",
    }).to(backdrop, { autoAlpha: 0, duration: 0.25 }, "<");
    return () => {
      tl.kill();
    };
  }, [open, mounted]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <>
      <div
        ref={backdropRef}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
      />
      <div className="pointer-events-none fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "pointer-events-auto flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-card text-card-foreground shadow-2xl ring-1 ring-foreground/10",
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                {title}
              </h2>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              onClick={onClose}
            >
              <XIcon />
            </Button>
          </div>
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}
