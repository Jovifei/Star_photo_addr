"use client";

import { useEffect } from "react";

/** iOS browser chrome and soft keyboards can change visual height without a layout breakpoint. */
export default function VisualViewportSize() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      if (height > 0) document.documentElement.style.setProperty("--mobile-visual-height", `${height}px`);
    };
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--mobile-visual-height");
    };
  }, []);
  return null;
}
