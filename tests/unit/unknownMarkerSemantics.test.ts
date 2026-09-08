import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { markerLevelFor } from "@/lib/markerStatus";

const cloudseaApp = readFileSync(
  new URL("../../src/app/cloudsea/CloudSeaApp.tsx", import.meta.url),
  "utf8",
);
const cloudseaDetail = readFileSync(
  new URL("../../src/app/cloudsea/CloudSeaSiteDetail.tsx", import.meta.url),
  "utf8",
);
const fireglowApp = readFileSync(
  new URL("../../src/app/fireglow/FireglowApp.tsx", import.meta.url),
  "utf8",
);
const fireglowDetail = readFileSync(
  new URL("../../src/app/fireglow/FireglowSiteDetail.tsx", import.meta.url),
  "utf8",
);
const fireglowModel = readFileSync(
  new URL("../../src/lib/fireglow.ts", import.meta.url),
  "utf8",
);

describe("unavailable score marker semantics", () => {
  it("classifies missing score or level as unknown without changing valid bands", () => {
    expect(markerLevelFor(null, "p20")).toBe("unknown");
    expect(markerLevelFor(12, null)).toBe("unknown");
    expect(markerLevelFor(12, "p20")).toBe("p20");
  });

  it("does not map a null CloudSea score to p20", () => {
    expect(cloudseaApp).not.toContain("conditionLevel ?? \"p20\"");
    expect(cloudseaDetail).not.toContain("conditionLevel ?? \"p20\"");
    expect(cloudseaApp).toContain("数据不足");
  });

  it("does not map a null Fireglow score to p20", () => {
    expect(fireglowApp).not.toContain("probabilityLevel ?? \"p20\"");
    expect(fireglowDetail).not.toContain("probabilityLevel ?? \"p20\"");
    expect(fireglowModel).not.toContain('probabilityLevel: "p20"');
    expect(fireglowModel).not.toContain('probabilityLabel: "0–20"');
    expect(fireglowApp).toContain("数据不足");
  });
});
