import { describe, expect, it } from "vitest";
import { astronomyAt, moonPhaseName } from "@/lib/astronomy";
import type { Location } from "@/lib/types";

const LOCATION: Location = {
  id: "phase-test",
  name: "phase-test",
  latitude: 30,
  longitude: 120,
  elevation: 0,
  source: "自定义",
};

describe("moon phase direction", () => {
  it("distinguishes waxing and waning names at the same illumination", () => {
    expect(moonPhaseName(0.5, 90)).toBe("上弦月");
    expect(moonPhaseName(0.5, 270)).toBe("下弦月");
    expect(moonPhaseName(0.25, 45)).toBe("娥眉月");
    expect(moonPhaseName(0.25, 315)).toBe("残月");
    expect(moonPhaseName(0.75, 135)).toBe("盈凸月");
    expect(moonPhaseName(0.75, 225)).toBe("亏凸月");
  });

  it("exposes the Astronomy Engine phase angle used to determine direction", () => {
    const result = astronomyAt(new Date("2026-08-12T12:00:00Z"), LOCATION);
    expect(result.moonPhaseAngle).toBeGreaterThanOrEqual(0);
    expect(result.moonPhaseAngle).toBeLessThan(360);
  });
});
