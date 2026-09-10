import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/appVersion";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };
const packageLock = JSON.parse(
  readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"),
) as { version: string; packages: { "": { version: string } } };
const headerSource = readFileSync(
  new URL("../../src/components/ProductHeader.tsx", import.meta.url),
  "utf8",
);
const changelogSource = readFileSync(
  new URL("../../src/components/ChangelogModal.tsx", import.meta.url),
  "utf8",
);

describe("release version consistency", () => {
  it("publishes v1.0.13 from the package and lockfile", () => {
    expect(packageJson.version).toBe("1.0.13");
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_VERSION_LABEL).toBe(`v${packageJson.version}`);
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[""].version).toBe(packageJson.version);
  });

  it("does not keep a hand-written product header version", () => {
    expect(headerSource).toContain("APP_VERSION_LABEL");
    expect(headerSource).not.toMatch(/v1\.0\.[456]/);
    expect(changelogSource).toContain("APP_VERSION_LABEL");
  });
});
