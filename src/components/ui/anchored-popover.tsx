"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 6;

export interface AnchoredPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: "start" | "end";
  width?: number | "anchor";
  className?: string;
  ariaLabel?: string;
}

const hiddenStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  visibility: "hidden",
};

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function AnchoredPopover({
  open,
  onClose,
  anchorRef,
  children,
  align = "end",
  width = 288,
  className = "",
  ariaLabel,
}: AnchoredPopoverProps) {
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const anchorRect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = Math.min(
      width === "anchor" ? anchorRect.width : width,
      Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2),
    );
    // Set dimensions before measuring so wrapping and height constraints count.
    panel.style.width = `${panelWidth}px`;
    panel.style.maxHeight = `${Math.max(0, viewportHeight - VIEWPORT_MARGIN * 2)}px`;
    const panelHeight = panel.offsetHeight;

    const spaceBelow =
      viewportHeight - anchorRect.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
    const spaceAbove = anchorRect.top - ANCHOR_GAP - VIEWPORT_MARGIN;
    const placeBelow =
      spaceBelow >= panelHeight || spaceBelow >= spaceAbove;

    let top = placeBelow
      ? anchorRect.bottom + ANCHOR_GAP
      : anchorRect.top - ANCHOR_GAP - panelHeight;

    let left =
      align === "end" ? anchorRect.right - panelWidth : anchorRect.left;

    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - panelWidth - VIEWPORT_MARGIN);
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), maxLeft);

    const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - panelHeight - VIEWPORT_MARGIN);
    top = Math.min(Math.max(top, VIEWPORT_MARGIN), maxTop);

    // Synchronize the measured position with the DOM without a render per scroll.
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    panel.style.visibility = "visible";
  }, [align, anchorRef, width]);

  useLayoutEffect(() => {
    if (!mounted || !open) return;
    reposition();
    const raf = window.requestAnimationFrame(reposition);
    return () => window.cancelAnimationFrame(raf);
  }, [mounted, open, reposition]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const handleViewportChange = () => reposition();

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [anchorRef, onClose, open, reposition]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      style={hiddenStyle}
      className={`z-[130] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-xl ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
