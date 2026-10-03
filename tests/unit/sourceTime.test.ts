import { afterEach, describe, expect, it, vi } from "vitest";
import { formatSourceUpdateTime } from "@/lib/sourceTime";

afterEach(() => vi.unstubAllEnvs());

describe("source update time display", () => {
  it.each(["UTC", "America/Los_Angeles", "Asia/Shanghai"])(
    "keeps China-time labels under the %s process timezone",
    (timezone) => {
      vi.stubEnv("TZ", timezone);
      expect(formatSourceUpdateTime("2026-10-03T05:15:00.573Z")).toBe("13:15");
      expect(formatSourceUpdateTime("2026-10-03T13:15:00.573+08:00")).toBe("13:15");
      expect(formatSourceUpdateTime("2026-10-03T16:05:00Z")).toBe("00:05");
    },
  );

  it.each([null, undefined, "", "not-a-date"])(
    "leaves absent or invalid timestamps unknown: %s",
    (value) => expect(formatSourceUpdateTime(value)).toBeNull(),
  );
});
