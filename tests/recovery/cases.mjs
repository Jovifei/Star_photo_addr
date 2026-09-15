import assert from "node:assert/strict";
import { DEFAULT_SCORING_MODEL, isForecastModel, missingScoringHour, missingScoringSeries, SCORING_REQUIRED_SERIES } from "../../src/lib/forecastPolicy.ts";
import { OpenMeteoGate, OpenMeteoRateLimitError, rateLimitDelayMs } from "../../src/lib/openMeteoRateLimit.ts";
import { observingContext, snapshotHealth, workerRetryAfterMs, nextWorkerDelay } from "../../scripts/observing-snapshot-worker-utils.mjs";

const now = Date.parse("2026-09-15T12:00:00Z");
const raw = () => ({ time: ["2026-09-15T20:00", "2026-09-15T21:00"], ...Object.fromEntries(SCORING_REQUIRED_SERIES.map(([field]) => [field, [1, 2]])) });
const fresh = () => ({ model: "gfs", stale: false, integrityVersion: "weather-integrity-v2", sourceFetchedAt: new Date(now).toISOString() });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const recoveryCases = [
  ["timeline quality checks precipitation probability as well as visibility", () => {
    const hour = { time: "2026-09-15T20:00", temperature: 10, humidity: 50, dewPoint: 0,
      precipitationProbability: 0, precipitation: 0, weatherCode: 0, cloudCover: 5,
      cloudLow: 3, cloudMid: 1, cloudHigh: 1, visibility: 25000, windSpeed: 1, windGust: 2 };
    assert.deepEqual(missingScoringHour(hour), []);
    assert.deepEqual(missingScoringHour({ ...hour, visibility: null }), ["能见度"]);
    assert.deepEqual(missingScoringHour({ ...hour, precipitationProbability: null }), ["降水概率"]);
    assert.deepEqual(missingScoringHour(null), ["所选时次"]);
  }],
  ["new sessions default to GFS; explicit ICON/AIFS remain valid choices", () => {
    assert.equal(DEFAULT_SCORING_MODEL, "gfs");
    for (const name of ["icon", "aifs", "gfs", "best_match"]) assert.equal(isForecastModel(name), true);
    for (const name of ["GFS", "", null, "unknown"]) assert.equal(isForecastModel(name), false);
  }],
  ["same-payload complete scoring series passes", () => assert.deepEqual(missingScoringSeries(raw()), [])],
  ["ICON-like all-null visibility fails without substituting another model", () => {
    const payload = raw(); payload.visibility = [null, null];
    assert.deepEqual(missingScoringSeries(payload), ["能见度"]);
    assert.deepEqual(payload.visibility, [null, null]);
  }],
  ["cloud-only health payload cannot pass scoring capability", () => {
    const payload = raw(); for (const [field] of SCORING_REQUIRED_SERIES) if (!field.startsWith("cloud_")) delete payload[field];
    assert.ok(missingScoringSeries(payload).includes("能见度"));
  }],
  ["every required series is checked independently", () => {
    for (const [field, label] of SCORING_REQUIRED_SERIES) {
      const payload = raw(); delete payload[field];
      assert.ok(missingScoringSeries(payload).includes(label));
    }
  }],
  ["strings, non-finite values and misaligned arrays fail", () => {
    for (const value of [["1", 2], [NaN, 2], [Infinity, 2], [1]]) {
      const payload = raw(); payload.visibility = value;
      assert.ok(missingScoringSeries(payload).includes("能见度"));
    }
  }],
  ["disjoint partial arrays cannot masquerade as a complete scoring hour", () => {
    const payload = raw(); payload.visibility = [1, null]; payload.cloud_cover = [null, 1];
    assert.deepEqual(missingScoringSeries(payload), ["同一时次的完整评分字段"]);
  }],
  ["missing, duplicate, reversed and malformed time axes fail", () => {
    for (const time of [[], ["bad"], ["2026-09-15T20:00", "2026-09-15T20:00"], ["2026-09-15T21:00", "2026-09-15T20:00"]]) {
      assert.ok(missingScoringSeries({ ...raw(), time }).length);
    }
  }],
  ["Retry-After longer than two minutes is preserved", () => assert.equal(rateLimitDelayMs("7200", "", now), 7_200_000)],
  ["HTTP-date Retry-After is supported", () => assert.equal(rateLimitDelayMs(new Date(now + 3_600_000).toUTCString(), "", now), 3_600_000)],
  ["daily/hourly/minutely reason backoffs are distinct", () => {
    assert.equal(rateLimitDelayMs(null, "Daily API request limit exceeded", now), 86_400_000);
    assert.equal(rateLimitDelayMs(null, "Hourly API request limit exceeded", now), 3_600_000);
    assert.equal(rateLimitDelayMs(null, "Minutely API request limit exceeded", now), 65_000);
  }],
  ["invalid Retry-After cannot shorten daily backoff", () => assert.equal(rateLimitDelayMs("invalid", "Daily API request limit exceeded", now), 86_400_000)],
  ["provider slot concurrency remains at two", async () => {
    const gate = new OpenMeteoGate(2); let active = 0; let peak = 0;
    await Promise.all(Array.from({ length: 8 }, () => gate.run(async () => {
      active += 1; peak = Math.max(peak, active); await delay(2); active -= 1;
    })));
    assert.equal(peak, 2);
  }],
  ["429 closes the gate before another queued request starts", async () => {
    const gate = new OpenMeteoGate(1, () => now); let requests = 0;
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => gate.run(async () => {
      requests += 1; return new Response(JSON.stringify({ reason: "Daily API request limit exceeded" }), { status: 429 });
    })));
    assert.equal(requests, 1);
    assert.ok(results.every((result) => result.status === "rejected" && result.reason instanceof OpenMeteoRateLimitError));
    assert.equal(gate.remainingMs(), 86_400_000);
  }],
  ["cooldown blocks new work; expiry permits an explicit request only", async () => {
    let clock = now; let requests = 0; const gate = new OpenMeteoGate(2, () => clock);
    gate.noteRateLimit("10");
    await assert.rejects(gate.run(async () => { requests += 1; }), OpenMeteoRateLimitError);
    clock += 10_001; assert.equal(requests, 0);
    await gate.run(async () => { requests += 1; }); assert.equal(requests, 1);
  }],
  ["later shorter limits cannot reopen an existing daily circuit", () => {
    const gate = new OpenMeteoGate(2, () => now);
    gate.noteRateLimit(null, "Daily API request limit exceeded"); gate.noteRateLimit("30");
    assert.equal(gate.remainingMs(), 86_400_000);
  }],
  ["synchronous callback failures release the provider slot", async () => {
    const gate = new OpenMeteoGate(1);
    await assert.rejects(gate.run(() => { throw new Error("expected"); }), /expected/);
    assert.equal(await gate.run(async () => 42), 42);
  }],
  ["Shanghai midnight uses the prior observing night", () => {
    assert.deepEqual(observingContext(new Date("2026-09-14T16:30:00Z")), {
      date: "2026-09-14", calendarDate: "2026-09-15", time: "2026-09-15T00:00",
    });
  }],
  ["05:59 remains prior night; 06:00 starts the new date", () => {
    assert.equal(observingContext(new Date("2026-09-14T21:59:00Z")).date, "2026-09-14");
    assert.equal(observingContext(new Date("2026-09-14T22:00:00Z")).date, "2026-09-15");
  }],
  ["observing-night rollover works across year boundaries", () => assert.equal(observingContext(new Date("2026-12-31T16:00:00Z")).date, "2026-12-31")],
  ["worker accepts a fresh explicit matching-model snapshot", () => assert.equal(snapshotHealth(fresh(), now, "gfs").shouldPrewarm, true)],
  ["worker rejects stale, wrong model and old-schema snapshots", () => {
    for (const patch of [{ stale: true }, { stale: undefined }, { model: "icon" }, { integrityVersion: "v1" }]) {
      assert.equal(snapshotHealth({ ...fresh(), ...patch }, now, "gfs").shouldPrewarm, false);
    }
  }],
  ["worker rejects a snapshot for a different observing night", () => {
    assert.equal(snapshotHealth({ ...fresh(), date: "2026-09-14" }, now, "gfs", "2026-09-15").shouldPrewarm, false);
  }],
  ["worker rejects invalid, offset-free, future and over-age source timestamps", () => {
    for (const sourceFetchedAt of ["", "bad", "2026-09-15T12:00:00", new Date(now + 600_000).toISOString(), new Date(now - 21_600_001).toISOString()]) {
      assert.equal(snapshotHealth({ ...fresh(), sourceFetchedAt }, now, "gfs").shouldPrewarm, false);
    }
  }],
  ["worker honors long Retry-After without timer overflow in its scheduler", () => {
    assert.equal(workerRetryAfterMs("86400", now), 86_400_000);
    assert.equal(workerRetryAfterMs(new Date(now + 3_600_000).toUTCString(), now), 3_600_000);
    assert.equal(nextWorkerDelay(60_000, false, 86_400_000), 86_400_000);
    assert.equal(nextWorkerDelay(60_000, false), 7_200_000);
  }],
];
