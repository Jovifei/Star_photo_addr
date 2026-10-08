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
