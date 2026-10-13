// Preloaded only by the offline E2E runner, including its Next server process.
// Fail before DNS/connect for non-loopback traffic; log hosts, never URLs/data.
const { appendFileSync } = require("node:fs");
if (process.env.E2E_OFFLINE !== "1") throw new Error("Offline guard requires E2E_OFFLINE=1");
const local = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
function check(host, transport) {
  if (local.has(String(host || "localhost").toLowerCase())) return;
  const error = new Error(`Offline E2E blocked ${transport} host ${host}`);
  error.code = "E2E_OFFLINE_EGRESS";
  if (process.env.E2E_OFFLINE_AUDIT) appendFileSync(process.env.E2E_OFFLINE_AUDIT,
    JSON.stringify({ host: String(host), transport, pid: process.pid }) + "\n");
  throw error;
}
const originalFetch = globalThis.fetch;
globalThis.fetch = function(input, init) {
  try { check(new URL(typeof input === "string" || input instanceof URL ? input : input.url).hostname, "fetch"); }
  catch (error) { return Promise.reject(error); }
  return originalFetch.call(this, input, init);
};
const net = require("node:net");
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  // net.createConnection passes Node's normalized [options, callback] tuple.
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const options = normalized[0];
  if (typeof options === "object" && options !== null) {
    if (!options.path) check(options.host, "socket");
  } else if (typeof options === "number") {
    check(typeof normalized[1] === "string" ? normalized[1] : "localhost", "socket");
  } else if (typeof options === "string" && /^\d+$/.test(options)) {
    check(typeof normalized[1] === "string" ? normalized[1] : "localhost", "socket");
  }
  return originalConnect.apply(this, args);
};
for (const name of ["node:http", "node:https"]) {
  const module = require(name);
  for (const method of ["request", "get"]) {
    const original = module[method];
    module[method] = function(input, ...args) {
      if (typeof input === "string" || input instanceof URL) check(new URL(input).hostname, name);
      else check(input?.hostname || input?.host, name);
      return original.call(this, input, ...args);
    };
  }
}
