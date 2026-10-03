import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));

// shadcn supplies a CLI and a stylesheet compiled by Tailwind. Its glob/AST
// tooling must not become part of the application's production dependency tree.
const buildOnlyPackages = [
  "shadcn",
  "braces",
  "micromatch",
  "fast-glob",
  "ts-morph",
  "@ts-morph/common",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

describe("build dependency boundary", () => {
  it("keeps the shadcn CLI and build stylesheet in devDependencies", () => {
    expect(manifest.dependencies).not.toHaveProperty("shadcn");
    expect(manifest.devDependencies.shadcn).toBeTruthy();
    expect(lock.packages[""].dependencies).not.toHaveProperty("shadcn");
    expect(lock.packages[""].devDependencies.shadcn).toBe(manifest.devDependencies.shadcn);
    expect(readFileSync("src/app/globals.css", "utf8")).toContain('@import "shadcn/tailwind.css";');
  });

  it("excludes the CLI glob and AST dependency chain from production installs", () => {
    for (const name of buildOnlyPackages) {
      const entries = Object.entries(lock.packages).filter(([path]) =>
        path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`),
      );
      expect(entries.length, `${name} should still be available for development`).toBeGreaterThan(0);
      for (const [path, metadata] of entries) {
        expect((metadata as { dev?: boolean }).dev, path).toBe(true);
      }
    }
  });

  it("does not import build-only JavaScript in application or worker sources", () => {
    const files = [...sourceFiles("src"), ...sourceFiles("scripts")];
    for (const name of buildOnlyPackages) {
      const imports = files.filter((path) =>
        new RegExp(`["']${name}(?:/[^"']*)?["']`).test(readFileSync(path, "utf8")),
      );
      expect(imports, name).toEqual([]);
    }
  });
});
