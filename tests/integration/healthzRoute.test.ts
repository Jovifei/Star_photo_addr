import { afterEach, expect, test } from "vitest";
import packageJson from "../../package.json";
import { GET } from "../../src/app/healthz/route";

const npmPackageVersion = process.env.npm_package_version;

afterEach(() => {
  if (npmPackageVersion === undefined) {
    delete process.env.npm_package_version;
    return;
  }
  process.env.npm_package_version = npmPackageVersion;
});

test("health route falls back to the package version outside an npm lifecycle", async () => {
  delete process.env.npm_package_version;

  const payload = await GET().json();

  expect(payload.version).toBe(packageJson.version);
});
