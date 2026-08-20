import { expect, test } from "@playwright/test";

const invalidCases = [
  ["forecast blank coordinates", "/api/forecast?latitude=&longitude=&model=gfs"],
  [
    "forecast mismatched coordinate lists",
    "/api/forecast?latitude=30.2,31.3&longitude=120.1&model=gfs",
  ],
  [
    "forecast invalid model",
    "/api/forecast?latitude=30.2&longitude=120.1&model=unknown",
  ],
  ["air quality blank coordinates", "/api/air-quality?lat=&lng="],
  ["pressure latitude out of range", "/api/pressure-forecast?lat=91&lng=120"],
  ["satellite invalid product", "/api/satellite/times?kind=forecast"],
] as const;

for (const [name, path] of invalidCases) {
  test(`${name} returns a non-cacheable 400`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(400);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });
}
