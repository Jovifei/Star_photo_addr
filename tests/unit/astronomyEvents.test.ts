import { describe, expect, it } from "vitest";
import { upcomingAstronomyEvents } from "@/lib/astronomyEvents";

describe("astronomy event context", () => {
  it("keeps the current weather headline independent from the event list", () => {
    const events = upcomingAstronomyEvents(new Date("2026-08-09T00:00:00.000Z"));
    expect(events[0].title).toBe("英仙座流星雨");
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.date)).toEqual([
      "2026-08-12",
      "2026-08-12",
      "2026-08-28",
    ]);
  });

  it("falls back to the most recent reviewed events after the season", () => {
    const events = upcomingAstronomyEvents(new Date("2027-01-01T00:00:00.000Z"), 2);
    expect(events).toHaveLength(2);
    expect(events[0].date).toBe("2026-08-28");
  });
});
