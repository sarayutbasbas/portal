export const DEV_TARGETS = Object.freeze({
  trip: "https://bn-trip.basnana.com/",
  games: "https://bn-games.basnana.com/",
  movie: "https://movie.basnana.com/",
  tools: "https://bn-tools.basnana.com/",
  portify: "https://portify.basnana.com/",
  "two-seats": "https://two-seats.basnana.com/",
  calio: "https://calio.basnana.com/",
  "house-rao": "https://bn-house-rao.basnana.com/",
});

export async function checkTarget(url, { fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  const started = Date.now();
  const signal = AbortSignal.timeout(timeoutMs);
  let current = new URL(url);
  try {
    // Follow only same-origin redirects; external authentication stays protected.
    for (let redirects = 0; redirects < 5; redirects++) {
      const response = await fetchImpl(current.href, {
        method: "GET", redirect: "manual", signal,
        headers: { "User-Agent": "BasnanaPortal-HealthCheck/1.0", Accept: "text/html" },
      });
      const httpStatus = response.status;
      const location = response.headers.get("location");
      await response.body?.cancel();
      const result = { httpStatus, latencyMs: Date.now() - started };
      if (httpStatus >= 300 && httpStatus < 400 && location) {
        const next = new URL(location, current);
        if (next.origin !== new URL(url).origin) {
          return { ...result, state: "protected", detail: "เปลี่ยนไปหน้าเข้าสู่ระบบหรือเว็บภายนอก" };
        }
        current = next;
        continue;
      }
      if (httpStatus === 401 || httpStatus === 403) {
        return { ...result, state: "protected", detail: `จำกัดการเข้าถึง · HTTP ${httpStatus}` };
      }
      return { ...result, state: response.ok ? "up" : "down", detail: `HTTP ${httpStatus}` };
    }
    return { state: "down", detail: "เปลี่ยนหน้าเกินจำนวนที่กำหนด", latencyMs: Date.now() - started };
  } catch (error) {
    return {
      state: "down", latencyMs: Date.now() - started,
      detail: signal.aborted ? "หมดเวลารอการตอบกลับ" : "เชื่อมต่อไม่ได้",
    };
  }
}

export async function checkAllTargets(options) {
  const entries = await Promise.all(Object.entries(DEV_TARGETS).map(async ([app, url]) => [
    app, { url, ...await checkTarget(url, options) },
  ]));
  return { checkedAt: new Date().toISOString(), apps: Object.fromEntries(entries) };
}
