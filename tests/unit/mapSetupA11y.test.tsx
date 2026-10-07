// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import MapSetup from "@/components/MapSetup";

afterEach(cleanup);

describe("MapSetup accessibility lifecycle", () => {
  it("announces active map loading as a status", () => {
    const { container } = render(<MapSetup hidden={false} />);
    const overlay = container.querySelector(".map-setup");
    const status = screen.getByRole("status");

    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains("hidden")).toBe(false);
    expect(overlay?.getAttribute("aria-hidden")).toBeNull();
    expect(status.textContent).toContain("正在加载地图图层");
  });

  it("keeps the faded overlay in the DOM but removes its stale loading semantics once ready", () => {
    const { container } = render(<MapSetup hidden />);
    const overlay = container.querySelector(".map-setup");

    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains("hidden")).toBe(true);
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("status")).toBeNull();
    expect(overlay?.textContent).toContain("正在加载地图图层");
  });
});
