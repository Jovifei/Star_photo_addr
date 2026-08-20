import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateRawForecast } from "@/lib/forecast";

const cases = JSON.parse(
  readFileSync(
    new URL("../fixtures/open-meteo/cloud-contract-cases.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;

type RawInput = Parameters<typeof validateRawForecast>[0];

function validate(name: string): void {
  validateRawForecast(cases[name] as RawInput);
}

describe("Open-Meteo cloud contract", () => {
  it("accepts four aligned cloud layers on a valid hourly axis", () => {
    expect(() => validate("valid")).not.toThrow();
  });

  it("rejects strings mixed into a numeric cloud series", () => {
    expect(() => validate("mixedType")).toThrow("有效低云");
  });

  it("rejects a cloud series whose length differs from the time axis", () => {
    expect(() => validate("misaligned")).toThrow("有效中云");
  });

  it("rejects an all-null required cloud series", () => {
    expect(() => validate("allNull")).toThrow("有效高云");
  });

  it("rejects a malformed hourly time value", () => {
    expect(() => validate("invalidTime")).toThrow("无效逐小时时间轴");
  });
});
