import test from "node:test";
import assert from "node:assert/strict";
import { checkTarget, checkAllTargets, DEV_TARGETS } from "../lib/status-check.mjs";

test("reports HTTP availability and distinguishes restricted access", async () => {
  for (const [code, state] of [[200, "up"], [404, "down"], [530, "down"], [401, "protected"], [403, "protected"]]) {
    const result = await checkTarget(DEV_TARGETS.trip, { fetchImpl: async () => new Response("", { status: code }) });
    assert.equal(result.state, state);
    assert.equal(result.httpStatus, code);
  }
});

test("follows same-origin redirects to the real application", async () => {
  const calls = [];
  const result = await checkTarget(DEV_TARGETS.movie, { fetchImpl: async (url) => {
    calls.push(url);
    return calls.length === 1
      ? new Response(null, { status: 302, headers: { location: "/web/index.html" } })
      : new Response("Movie");
  } });
  assert.equal(result.state, "up");
  assert.equal(calls[1], "https://movie.basnana.com/web/index.html");
});

test("does not follow redirects outside the allowlisted application origin", async () => {
  let calls = 0;
  const result = await checkTarget(DEV_TARGETS.movie, { fetchImpl: async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
  } });
  assert.equal(result.state, "protected");
  assert.equal(calls, 1);
});

test("reports connection failures and stops redirect loops", async () => {
  const disconnected = await checkTarget(DEV_TARGETS.tools, { fetchImpl: async () => { throw new Error("unreachable"); } });
  assert.equal(disconnected.state, "down");
  assert.equal(disconnected.detail, "เชื่อมต่อไม่ได้");
  let calls = 0;
  const loop = await checkTarget(DEV_TARGETS.tools, { fetchImpl: async () => {
    calls++;
    return new Response(null, { status: 307, headers: { location: "/" } });
  } });
  assert.equal(loop.state, "down");
  assert.equal(calls, 5);
});

test("enforces an end-to-end timeout", async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const result = await checkTarget(DEV_TARGETS.tools, { timeoutMs: 10, fetchImpl: (_url, { signal }) =>
      new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))) });
    assert.equal(result.state, "down");
    assert.equal(result.detail, "หมดเวลารอการตอบกลับ");
  } finally { clearTimeout(keepAlive); }
});

test("checks all eight fixed Dev destinations including Production fallbacks", async () => {
  const requested = [];
  const result = await checkAllTargets({ fetchImpl: async (url) => {
    requested.push(url);
    return new Response("", { status: url.includes("bn-tools") ? 404 : 200 });
  } });
  assert.deepEqual(requested.sort(), Object.values(DEV_TARGETS).sort());
  assert.equal(Object.keys(result.apps).length, 8);
  assert.equal(result.apps.tools.state, "down");
  assert.equal(result.apps.trip.state, "up");
  assert.equal(result.apps.calio.url, "https://calio.basnana.com/");
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
});
