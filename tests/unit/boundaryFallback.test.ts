import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const boundarySource = readFileSync(
  new URL("../../src/components/BoundaryLayers.tsx", import.meta.url),
  "utf8",
);
const labelsSource = readFileSync(
  new URL("../../src/components/ChineseLabelLayer.tsx", import.meta.url),
  "utf8",
);

describe("administrative boundary source policy", () => {
  it("fails closed instead of requesting the DataV remote fallback", () => {
    expect(boundarySource).not.toContain("geo.datav.aliyun.com");
    expect(boundarySource).not.toContain("REMOTE_PROVINCE");
    expect(boundarySource).not.toContain("loadRemoteProvinces");
  });

  it("retains the official Tianditu layer path", () => {
    expect(labelsSource).toContain("TIANDITU_CIA_W_URL");
    expect(labelsSource).toContain("ibo_w");
    expect(labelsSource).toContain("cia_w");
  });
});
