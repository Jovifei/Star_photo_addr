import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("observing map catalog-Bortle labels", () => {
  it("keeps the live places panel explicit that B1-B4 are catalog references", () => {
    const source = fs.readFileSync("src/components/ObservingMapControl.tsx", "utf8");
    expect(source).toContain("参考 B 筛选");
    expect(source).toContain("不是当前坐标的授权栅格或现场 SQM 实测");
    expect(source).toContain("不进入实时天气推荐分");
    expect(source).toContain("地图点颜色表示目录参考等级");
    expect(source).not.toContain("长期暗空本底（Bortle / 海拔 / 光污染）");
    expect(source).not.toContain("地图上的点按光污染本底着色");
  });
});
