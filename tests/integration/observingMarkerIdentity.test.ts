// @vitest-environment jsdom
import { createElement, Fragment } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapContainer } from "react-leaflet";
import { ObservingSiteMarker } from "@/components/ObservingSitesLayer";

afterEach(cleanup);
const position: [number, number] = [30, 120];
function dispatchTouchPointer(
  element: HTMLElement,
  type: string,
  pointerId: number,
  isPrimary: boolean,
  x = 20,
  y = 20,
) {
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: "touch" },
    isPrimary: { value: isPrimary },
    clientX: { value: x },
    clientY: { value: y },
  });
  element.dispatchEvent(event);
}

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

  it("does not select a marker when a multi-touch gesture ends", () => {
    const onClick = vi.fn();
    const { container } = render(createElement(Scene, { onClick }));
    const marker = container.querySelector<HTMLElement>(".leaflet-marker-icon")!;

    dispatchTouchPointer(marker, "pointerdown", 1, true, 20, 20);
    dispatchTouchPointer(marker, "pointerdown", 2, false, 21, 20);
    dispatchTouchPointer(marker, "pointerup", 1, true, 20, 20);
    dispatchTouchPointer(marker, "pointerup", 2, false, 21, 20);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("invalidates a marker tap when the second touch starts on another marker", () => {
    const onClick = vi.fn();
    const { container } = render(createElement(Scene, { onClick, twin: true }));
    const markers = container.querySelectorAll<HTMLElement>(".leaflet-marker-icon");
    const first = markers[0]!;
    const second = markers[1]!;

    dispatchTouchPointer(first, "pointerdown", 1, true, 20, 20);
    dispatchTouchPointer(second, "pointerdown", 2, false, 40, 40);
    dispatchTouchPointer(first, "pointerup", 1, true, 20, 20);
    dispatchTouchPointer(second, "pointerup", 2, false, 40, 40);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not select after pointer cancellation and still accepts the next tap", () => {
    const onClick = vi.fn();
    const { container } = render(createElement(Scene, { onClick }));
    const marker = container.querySelector<HTMLElement>(".leaflet-marker-icon")!;

    dispatchTouchPointer(marker, "pointerdown", 1, true);
    dispatchTouchPointer(marker, "pointercancel", 1, true);
    marker.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(onClick).not.toHaveBeenCalled();

    dispatchTouchPointer(marker, "pointerdown", 2, true);
    dispatchTouchPointer(marker, "pointerup", 2, true);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
