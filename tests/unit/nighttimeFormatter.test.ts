import { describe, expect, it, vi } from "vitest";
import { localDateKey } from "@/lib/nighttime";
describe("reusable date-key formatter", () => {
  it("reuses one timezone formatter across distinct dates and preserves calendar boundaries", () => {
    const Original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (locales, options) { return new Original(locales, options); });
    try {
      expect(localDateKey(new Date("2026-10-01T12:00:00Z"), "Pacific/Auckland")).toBe("2026-10-02");
      expect(localDateKey(new Date("2026-12-31T12:00:00Z"), "Pacific/Auckland")).toBe("2027-01-01");
      expect(spy).toHaveBeenCalledTimes(1);
      expect(localDateKey(new Date("2026-12-31T12:00:00Z"), "America/New_York")).toBe("2026-12-31");
      expect(spy).toHaveBeenCalledTimes(2);
      expect(() => localDateKey(new Date("invalid"), "Pacific/Auckland")).toThrow(RangeError);
      expect(() => localDateKey(new Date(), "Invalid/Timezone")).toThrow(RangeError);
    } finally { spy.mockRestore(); }
  });
});
