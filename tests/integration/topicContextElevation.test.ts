// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePublishTopicContext } from "@/hooks/useTopicContext";
import { readProductLinkContext } from "@/lib/productRoutes";

/**
 * Regression: topic pages (fireglow/cloudsea) republish their own URL via
 * history.replaceState. The published URL must keep the selected point's
 * elevation — dropping it made cross-workspace jumps home lose the catalogue
 * altitude and fall back to sea-level geometry (Balangshan 4480 m case,
 * reproduced live 2026-11-07 after PR #68 fixed only the reading side).
 */

const BALANG = { latitude: 30.944, longitude: 102.903 };

const CLOUDSEA_CATALOGUE = [
  { id: "cs-balangshan", name: "巴朗山垭口", ...BALANG, altitude: 4480 },
  { id: "cs-lowland", name: "无海拔站点", latitude: 31.1, longitude: 121.4, altitude: null },
];

function incomingWithElevation(elevation: string | null) {
  const params = new URLSearchParams({
    contextVersion: "2",
    sourceScope: "coordinate",
    sourceId: "custom-30.94400-102.90300",
    canonicalId: "coordinate:custom-30.94400-102.90300",
    lat: String(BALANG.latitude),
    lng: String(BALANG.longitude),
    name: "巴朗山垭口",
    night: "2026-11-07",
    model: "best_match",
  });
  if (elevation !== null) params.set("elevation", elevation);
  return readProductLinkContext(params);
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("usePublishTopicContext elevation preservation", () => {
  it("keeps the catalogue altitude when publishing the cloudsea URL for a selected site", () => {
    renderHook(() =>
      usePublishTopicContext(
        "/cloudsea", CLOUDSEA_CATALOGUE, "cloudsea", "cs-balangshan", BALANG,
        "2026-11-07", "evening", incomingWithElevation("4480"), undefined, "best_match",
      ),
    );
    const url = new URL(window.location.href);
    expect(url.pathname).toBe("/cloudsea");
    expect(url.searchParams.get("sourceScope")).toBe("cloudsea");
    expect(url.searchParams.get("elevation")).toBe("4480");
  });

  it("carries a coordinate point's incoming elevation when no catalogue site matches", () => {
    renderHook(() =>
      usePublishTopicContext(
        "/cloudsea", CLOUDSEA_CATALOGUE, "cloudsea", "not-a-site", BALANG,
        "2026-11-07", "evening", incomingWithElevation("4480"), undefined, "best_match",
      ),
    );
    const url = new URL(window.location.href);
    expect(url.searchParams.get("elevation")).toBe("4480");
  });

  it("never fabricates an elevation when none is known", () => {
    renderHook(() =>
      usePublishTopicContext(
        "/cloudsea", CLOUDSEA_CATALOGUE, "cloudsea", "cs-lowland",
        { latitude: 31.1, longitude: 121.4 },
        "2026-11-07", "evening", incomingWithElevation(null), undefined, "best_match",
      ),
    );
    const url = new URL(window.location.href);
    expect(url.searchParams.has("elevation")).toBe(false);
  });
});
