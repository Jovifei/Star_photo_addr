import { test } from "node:test";
import { recoveryCases } from "../tests/recovery/cases.mjs";
import { workerCases } from "../tests/recovery/worker-cases.mjs";
for (const [name, run] of [...recoveryCases, ...workerCases]) test(name, run);
