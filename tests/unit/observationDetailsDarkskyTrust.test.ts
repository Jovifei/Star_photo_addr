import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("observation detail dark-sky no-data contract", () => {
  it("never falls back to geographic/catalog Bortle or estimated SQM", () => {
    const source = fs.readFileSync("src/components/ObservationDetails.tsx", "utf8");
    expect(source).not.toContain("estimateDarkSky");
    expect(source).not.toContain("mpsas (估算)");
    expect(source).not.toContain("卫星夜光及地理模型估算值");
    expect(source).not.toContain("location.bortle");
    expect(source).toContain("无可信栅格读数");
    expect(source).toContain("不会根据坐标、海拔或点位目录推算 Bortle/SQM");
  });
});
