import { expect, it } from "vitest";
import { settleTopicDates, TopicCooldownError } from "@/lib/topicRequestPolicy";
it("stops at provider cooldown while preserving completed dates and never calls later dates", async () => {
  const calls: string[] = [];
  const results = await settleTopicDates(["one", "two", "three"], async date => {
    calls.push(date); if (date === "two") throw new TopicCooldownError("429", "600"); return date;
  });
  expect(calls).toEqual(["one", "two"]);
  expect(results.map(result => result.status)).toEqual(["fulfilled", "rejected", "rejected"]);
});
it("isolates ordinary failures and stops obsolete aborted requests", async () => {
  let calls = 0;
  await settleTopicDates(["one", "two"], async () => { calls += 1; throw new Error("bad date"); });
  expect(calls).toBe(2);
  calls = 0;
  await settleTopicDates(["one", "two"], async () => { calls += 1; throw new DOMException("aborted", "AbortError"); });
  expect(calls).toBe(1);
});

it("accepts the current retained payload before transport cooldown stops later dates", async () => {
  const calls: string[] = [];
  const retained = { stale: true, sourceFetchedAt: "2026-10-08T00:00:00Z", score: 72 };
  const results = await settleTopicDates(["one", "two", "three"], async date => {
    calls.push(date); return retained;
  }, () => new TopicCooldownError("retained response cooldown", "600"));
  expect(calls).toEqual(["one"]);
  expect(results[0]).toEqual({ status: "fulfilled", value: retained });
  expect(results[1].status).toBe("rejected"); expect(results[2].status).toBe("rejected");
});
