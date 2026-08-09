// Unit tests for the night-window helpers in `src/lib/nighttime.ts`.
//
// Rule under test (see docs/design + constants): the observation window is
// 20:00 (local, evening date) → 05:00 (local, next morning). The canonical
// rule is "当日 ≥20:00 或 次日 ≤05:00 为夜间", i.e. the 05:00 hour is INCLUDED.
//
// Coverage map (PRD acceptance criteria):
//   AC-1  formatNightLabel  full 形态
//   AC-2  formatNightLabel  compact 形态
//   AC-3  formatHourWithDate 跨午夜提示
//   AC-4  formatHour        签名与行为不得变更（scoring.ts windowLabel 依赖）
import { describe, it, expect } from "vitest";
import {
  formatHour,
  formatHourWithDate,
  formatNightLabel,
  currentNightKey,
  initialForecastTime,
  isInNight,
  nightHourIndex,
  nextNightKeys,
} from "@/lib/nighttime";
import { NIGHT_END, NIGHT_START } from "@/lib/constants";

const NIGHT = "2026-08-12"; // evening date; window spans → 2026-08-13 05:00

describe("home night defaults", () => {
  it("uses tonight after daytime starts, not the fixed Perseids peak night", () => {
    const now = new Date("2026-08-09T09:00:00.000Z"); // 17:00 Shanghai
    expect(nextNightKeys(1, now)).toEqual(["2026-08-09"]);
    expect(initialForecastTime(now)).toBe("2026-08-09T17:00");
  });

  it("keeps the current early-morning hour attached to the previous evening", () => {
    const now = new Date("2026-08-08T19:30:00.000Z"); // 03:30 Shanghai
    expect(initialForecastTime(now)).toBe("2026-08-09T03:00");
    expect(nightHourIndex("2026-08-09T03:00")).toBe(7);
  });

  it("keeps daytime map state on the current hour while the matrix starts at 20:00", () => {
    expect(nightHourIndex("2026-08-09T17:00")).toBe(0);
  });

  it("treats 06:00 as the next evening rather than the night that already ended", () => {
    const now = new Date("2026-08-08T22:00:00.000Z"); // 06:00 Shanghai
    expect(currentNightKey(now)).toBe("2026-08-09");
  });
});

describe("isInNight — 当日夜间 (≥20:00)", () => {
  it("20:00 是夜间起点", () => {
    expect(isInNight("2026-08-12T20:00", NIGHT)).toBe(true);
  });
  it("23:59 属于夜间", () => {
    expect(isInNight("2026-08-12T23:59", NIGHT)).toBe(true);
  });
});

describe("isInNight — 次日跨日回绕 (≤05:00)", () => {
  it("00:00 属于次日夜间", () => {
    expect(isInNight("2026-08-13T00:00", NIGHT)).toBe(true);
  });
  it("04:59 属于次日夜间", () => {
    expect(isInNight("2026-08-13T04:59", NIGHT)).toBe(true);
  });
  it("05:00 按 ≤05:00 规则计入夜间（边界含入）", () => {
    // 规则明确为「次日 ≤05:00 为夜间」，实现用 hour <= NIGHT_END(5)。
    expect(isInNight("2026-08-13T05:00", NIGHT)).toBe(true);
  });
});

describe("isInNight — 非夜间窗口", () => {
  it("12:00 非夜间", () => {
    expect(isInNight("2026-08-12T12:00", NIGHT)).toBe(false);
  });
  it("19:59 未到 20:00，非夜间", () => {
    expect(isInNight("2026-08-12T19:59", NIGHT)).toBe(false);
  });
  it("06:00 越过 05:00，非夜间", () => {
    expect(isInNight("2026-08-13T06:00", NIGHT)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-1 / AC-2 — formatNightLabel
// ---------------------------------------------------------------------------

describe("formatNightLabel — 完整形态 (AC-1)", () => {
  it("2026-08-07（周五）渲染为「8月7日 周五 夜间（20:00–次日05:00）」", () => {
    expect(formatNightLabel("2026-08-07", false)).toBe(
      "8月7日 周五 夜间（20:00–次日05:00）",
    );
  });

  it("compact 参数缺省时等价于 full", () => {
    expect(formatNightLabel("2026-08-07")).toBe(
      formatNightLabel("2026-08-07", false),
    );
  });

  it("月/日不做零填充（8月7日 而非 08月07日）", () => {
    const label = formatNightLabel("2026-08-07", false);
    expect(label.startsWith("8月7日")).toBe(true);
    expect(label).not.toContain("08月");
  });

  it("窗口文案由 NIGHT_START/NIGHT_END 常量驱动，且始终带「次日」", () => {
    const label = formatNightLabel("2026-08-12", false);
    expect(label).toContain(`（${NIGHT_START}:00–次日0${NIGHT_END}:00）`);
  });

  it("锚定傍晚日：星期几取 dateKey 当天而非次日", () => {
    // 2026-08-12 是周三；若实现误用次日会渲染成周四。
    expect(formatNightLabel("2026-08-12", false)).toBe(
      "8月12日 周三 夜间（20:00–次日05:00）",
    );
  });

  it("跨月边界 2026-08-31 仍锚定当日", () => {
    expect(formatNightLabel("2026-08-31", false)).toBe(
      "8月31日 周一 夜间（20:00–次日05:00）",
    );
  });
});

describe("formatNightLabel — 紧凑形态 (AC-2)", () => {
  it("2026-08-07 渲染为「8/7 周五夜」", () => {
    expect(formatNightLabel("2026-08-07", true)).toBe("8/7 周五夜");
  });

  it("双位日期 2026-08-12 渲染为「8/12 周三夜」", () => {
    expect(formatNightLabel("2026-08-12", true)).toBe("8/12 周三夜");
  });

  it("紧凑形态保留星期，但不重复完整窗口区间", () => {
    const label = formatNightLabel("2026-08-07", true);
    expect(label).toContain("周五");
    expect(label).not.toContain("次日");
  });
});

describe("formatNightLabel — 坏输入兜底", () => {
  it("非日期字符串原样返回", () => {
    expect(formatNightLabel("garbage")).toBe("garbage");
  });

  it("坏输入在 compact 模式下同样原样返回（兜底先于 compact 分支）", () => {
    expect(formatNightLabel("garbage", true)).toBe("garbage");
  });

  it("空字符串原样返回", () => {
    expect(formatNightLabel("")).toBe("");
  });

  it("月/日段非数字时原样返回", () => {
    expect(formatNightLabel("2026-AA-BB")).toBe("2026-AA-BB");
  });
});

// ---------------------------------------------------------------------------
// AC-3 — formatHourWithDate
// ---------------------------------------------------------------------------

describe("formatHourWithDate — 同日时段不加提示 (AC-3)", () => {
  it.each([
    ["2026-08-07T20:00", "20:00"],
    ["2026-08-07T22:00", "22:00"],
    ["2026-08-07T23:00", "23:00"],
  ])("%s → %s", (input, expected) => {
    expect(formatHourWithDate(input, "2026-08-07")).toBe(expected);
  });
});

describe("formatHourWithDate — 跨午夜加「（次日）」提示 (AC-3)", () => {
  it.each([
    ["2026-08-08T00:00", "00:00（次日）"],
    ["2026-08-08T01:00", "01:00（次日）"],
    ["2026-08-08T05:00", "05:00（次日）"],
  ])("%s → %s", (input, expected) => {
    expect(formatHourWithDate(input, "2026-08-07")).toBe(expected);
  });
});

describe("formatHourWithDate — datePart/nightKey 缺失时按小时兜底", () => {
  it("nightKey 为空串时，01:00 按 ≤NIGHT_END 判定为次日", () => {
    expect(formatHourWithDate("2026-08-08T01:00", "")).toBe("01:00（次日）");
  });

  it("nightKey 为空串时，22:00 判定为当日", () => {
    expect(formatHourWithDate("2026-08-07T22:00", "")).toBe("22:00");
  });

  it("兜底分支的 05:00 边界含入次日", () => {
    expect(formatHourWithDate("2026-08-08T05:00", "n/a")).toBe("05:00（次日）");
  });

  it("兜底分支的 06:00 越界，不标次日", () => {
    expect(formatHourWithDate("2026-08-08T06:00", "n/a")).toBe("06:00");
  });
});

// ---------------------------------------------------------------------------
// AC-4 — formatHour 行为锁定（回归红线）
// ---------------------------------------------------------------------------

describe("formatHour — 行为锁定，禁止变更 (AC-4)", () => {
  it("2026-08-07T22:00 → 22:00", () => {
    expect(formatHour("2026-08-07T22:00")).toBe("22:00");
  });

  it("等价于 slice(11, 16)，不做任何跨日修饰", () => {
    for (const t of [
      "2026-08-07T20:00",
      "2026-08-08T00:00",
      "2026-08-08T05:00",
      "2026-08-13T05:00",
    ]) {
      expect(formatHour(t)).toBe(t.slice(11, 16));
      expect(formatHour(t)).not.toContain("次日");
    }
  });

  it("保持单参数签名（scoring.ts windowLabel 依赖）", () => {
    expect(formatHour.length).toBe(1);
  });

  it("scoring.ts 的 windowLabel 拼装形态不含次日后缀", () => {
    // 复刻 src/lib/scoring.ts:207 的拼装方式，锁定其输出契约。
    const label = `${formatHour("2026-08-07T20:00")}–${formatHour("2026-08-08T02:00")}（6h）`;
    expect(label).toBe("20:00–02:00（6h）");
  });
});
