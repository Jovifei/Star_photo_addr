// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/store", () => ({ useStore: () => ({ state: { selectedLocation: null, selectedNight: "2026-10-05", cloudState: { model: "icon", overlayMode: "forecast-cloud" } } }) }));
import NavTabs from "@/components/NavTabs";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("compact navigation height reservation", () => {
  it("updates the owning shell when text wraps and disconnects on unmount", () => {
    let height = 56;
    let resized!: ResizeObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { resized = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ height, width: 375, x: 0, y: 0, top: 0, bottom: height, left: 0, right: 375, toJSON: () => ({}) }));
    const { container, unmount } = render(createElement("div", { className: "app-shell" }, createElement(NavTabs)));
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.style.getPropertyValue("--product-navigation-height")).toBe("56px");
    height = 71.2;
    act(() => resized([], {} as ResizeObserver));
    expect(shell.style.getPropertyValue("--product-navigation-height")).toBe("72px");
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(shell.style.getPropertyValue("--product-navigation-height")).toBe("");
  });
});
