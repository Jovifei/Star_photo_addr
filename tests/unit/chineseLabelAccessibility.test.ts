// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const hosts = vi.hoisted(() => [] as HTMLElement[]);
vi.mock("@/lib/labelLayout", () => ({ spacedLabelIndices: () => [0, 1] }));
vi.mock("react-leaflet", async () => {
  const { Fragment, createElement, useEffect } = await import("react");
  const Wrapper = ({ children }: { children?: React.ReactNode }) => createElement(Fragment, null, children);
  return {
    CircleMarker: Wrapper, Pane: Wrapper, TileLayer: () => null,
    useMapEvents: () => ({ getSize: () => ({ x: 375, y: 500 }), latLngToContainerPoint: () => ({ x: 100, y: 100 }) }),
    Tooltip: function Tooltip({ children, eventHandlers }: { children: string; eventHandlers?: { add?: (event: { target: { getElement: () => HTMLElement } }) => void } }) {
      useEffect(() => {
        const host = document.createElement("div"); host.setAttribute("role", "tooltip");
        host.textContent = children; document.body.appendChild(host); hosts.push(host);
        eventHandlers?.add?.({ target: { getElement: () => host } });
        // Model Leaflet's retained fading host after React portal cleanup.
        return () => { host.replaceChildren(); host.style.opacity = "0"; };
      }, [children, eventHandlers]);
      return null;
    },
  };
});
import ChineseLabelLayer from "@/components/ChineseLabelLayer";
afterEach(() => { cleanup(); hosts.splice(0).forEach((host) => host.remove()); vi.unstubAllEnvs(); });
describe("fallback tooltip accessible names", () => {
  it("gives each host its own visible place name without hiding the label", () => {
    vi.stubEnv("NEXT_PUBLIC_TIANDITU_TOKEN", "");
    render(createElement(ChineseLabelLayer));
    for (const name of ["中国", "北京"]) {
      const tooltip = screen.getByRole("tooltip", { name });
      expect(tooltip.textContent).toBe(name);
      expect(tooltip.getAttribute("aria-label")).toBe(name);
      expect(tooltip.hasAttribute("aria-hidden")).toBe(false);
    }
  });
  it("retains the name after portal text is cleared during the fade-out interval", () => {
    vi.stubEnv("NEXT_PUBLIC_TIANDITU_TOKEN", "");
    const { unmount } = render(createElement(ChineseLabelLayer));
    unmount();
    for (const name of ["中国", "北京"]) {
      const tooltip = screen.getByRole("tooltip", { name });
      expect(tooltip.textContent).toBe("");
      expect(tooltip.style.opacity).toBe("0");
      expect(tooltip.getAttribute("aria-label")).toBe(name);
    }
  });
});
