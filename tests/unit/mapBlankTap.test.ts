// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ map: null as null | {
  getContainer: () => HTMLElement;
  mouseEventToLatLng: (event: MouseEvent) => { lat: number; lng: number };
} }));
vi.mock("react-leaflet", () => ({ useMap: () => mock.map! }));
import { useMapBlankTap } from "@/hooks/useMapBlankTap";

let container: HTMLDivElement;
let blank: HTMLDivElement;
let retry: HTMLButtonElement;
const pick = vi.fn();
function Listener() { useMapBlankTap(pick, ".marker, .leaflet-control"); return null; }
function pointer(target: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, "pointerType", { value: "touch" });
  target.dispatchEvent(event);
}

beforeEach(() => {
  pick.mockClear();
  container = document.createElement("div");
  blank = document.createElement("div");
  const status = document.createElement("div");
  status.className = "map-render-status map-render-status--tile";
  retry = document.createElement("button");
  retry.textContent = "重试地图图层";
  status.append(retry);
  container.append(blank, status);
  document.body.append(container);
  mock.map = { getContainer: () => container, mouseEventToLatLng: event => ({ lat: event.clientY, lng: event.clientX }) };
  render(createElement(Listener));
});
afterEach(() => { cleanup(); container.remove(); mock.map = null; });

describe("blank-map gestures exclude map status controls", () => {
  it("does not sample a location when the retry button receives a mouse click", () => {
    retry.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 40, clientY: 60 }));
    expect(pick).not.toHaveBeenCalled();
  });
  it("does not sample through a status control's touch pointer-up or synthesized click", () => {
    pointer(retry, "pointerdown", 40, 60);
    pointer(retry, "pointerup", 40, 60);
    retry.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 40, clientY: 60 }));
    expect(pick).not.toHaveBeenCalled();
  });
  it("also excludes a nested label in the satellite status lane", () => {
    const status = retry.parentElement!;
    status.className = "map-render-status map-render-status--satellite";
    const label = document.createElement("span");
    retry.append(label);
    label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(pick).not.toHaveBeenCalled();
  });
  it("keeps keyboard-style and repeated button activation working without sampling", () => {
    const action = vi.fn();
    retry.addEventListener("click", action);
    for (const key of ["Enter", " ", "Enter"]) {
      retry.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      // A native button activation emits a click with no pointer-down. The
      // browser regression separately drives real Enter/Space activation.
      retry.click();
    }
    expect(action).toHaveBeenCalledTimes(3);
    expect(pick).not.toHaveBeenCalled();
  });
  it("does not turn a touch begun on a disappearing status control into a blank-map pick", () => {
    pointer(retry, "pointerdown", 40, 60);
    retry.parentElement!.remove();
    pointer(blank, "pointerup", 40, 60);
    blank.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 40, clientY: 60 }));
    expect(pick).not.toHaveBeenCalled();
    pointer(blank, "pointerdown", 50, 70);
    pointer(blank, "pointerup", 50, 70);
    expect(pick).toHaveBeenCalledOnce();
  });
  it("preserves a blank mouse click and de-duplicates a blank touch click", () => {
    blank.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 20 }));
    expect(pick).toHaveBeenLastCalledWith(20, 10);
    pointer(blank, "pointerdown", 30, 40);
    pointer(blank, "pointerup", 30, 40);
    blank.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 30, clientY: 40 }));
    expect(pick).toHaveBeenCalledTimes(2);
    expect(pick).toHaveBeenLastCalledWith(40, 30);
  });
  it("preserves drag suppression and existing marker/control exclusions", () => {
    pointer(blank, "pointerdown", 10, 20);
    pointer(blank, "pointermove", 100, 120);
    pointer(blank, "pointerup", 100, 120);
    blank.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 100, clientY: 120 }));
    for (const className of ["marker", "leaflet-control"]) {
      blank.className = className;
      pointer(blank, "pointerdown", 10, 20);
      pointer(blank, "pointerup", 10, 20);
      blank.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 20 }));
    }
    expect(pick).not.toHaveBeenCalled();
  });
});
