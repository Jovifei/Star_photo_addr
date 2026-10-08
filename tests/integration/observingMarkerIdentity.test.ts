// @vitest-environment jsdom
import { createElement, Fragment } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapContainer } from "react-leaflet";
import { ObservingSiteMarker } from "@/components/ObservingSitesLayer";

afterEach(cleanup);
const position: [number, number] = [30, 120];
function Scene({ revision = 0, color = "#63e6e2", selected = false, bortle = 2, onClick = () => undefined, twin = false }: {
  revision?: number; color?: string; selected?: boolean; bortle?: number; onClick?: () => void; twin?: boolean;
}) {
  return createElement(Fragment, null,
    createElement("output", { "data-testid": "revision" }, revision),
    createElement(MapContainer, { center: position, zoom: 4, style: { width: 400, height: 300 } },
      createElement(ObservingSiteMarker, { position, color, selected, bortle, title: "site", eventHandlers: { click: onClick } }),
      twin && createElement(ObservingSiteMarker, { position: [31, 121], color, selected, bortle, title: "other site" }),
    ));
}

describe("observing marker presentation identity", () => {
  it("preserves the actual Leaflet dot on unrelated React renders", () => {
    const { container, rerender } = render(createElement(Scene));
    const dot = container.querySelector(".observing-site-dot")!;
    expect(dot).not.toBeNull();
    rerender(createElement(Scene, { revision: 1 }));
    expect(screen.getByTestId("revision").textContent).toBe("1");
    expect(container.querySelector(".observing-site-dot")).toBe(dot);
    expect(dot.isConnected).toBe(true);
  });
  it("updates real color, selection and reference-grade changes while retaining click behavior", () => {
    const onClick = vi.fn();
    const { container, rerender } = render(createElement(Scene, { onClick }));
    rerender(createElement(Scene, { color: "#e97979", selected: true, bortle: 4, onClick }));
    const dot = container.querySelector<HTMLElement>(".observing-site-dot")!;
    expect(dot.style.getPropertyValue("--site-color")).toBe("#e97979");
    expect(dot.style.getPropertyValue("--site-scale")).toBe("1.28");
    expect(dot.getAttribute("data-bortle")).toBe("4");
    fireEvent.click(dot);
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("owns one icon per mounted marker and releases its DOM on unmount", () => {
    const { container, unmount } = render(createElement(Scene, { twin: true }));
    const dots = [...container.querySelectorAll(".observing-site-dot")];
    expect(dots).toHaveLength(2);
    expect(dots[0]).not.toBe(dots[1]);
    unmount();
    expect(dots.every(dot => !dot.isConnected)).toBe(true);
  });
});
