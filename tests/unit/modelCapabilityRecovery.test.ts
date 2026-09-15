import { test } from "vitest";
import { recoveryCases } from "../recovery/cases.mjs";
import { workerCases } from "../recovery/worker-cases.mjs";
for (const [name, run] of [...recoveryCases, ...workerCases]) {
  test(name as string, run as () => void | Promise<void>);
}
