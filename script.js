const portalList = document.querySelector("#portal-list");
const viewButtons = [...document.querySelectorAll("[data-view-option]")];
const themeButton = document.querySelector("#theme-button");
const announcement = document.querySelector("#portal-announcement");
const themeColor = document.querySelector('meta[name="theme-color"]');
const validViews = new Set(["rows", "grid"]);
const environmentButtons = [...document.querySelectorAll("[data-environment-option]")];
const portalCards = [...document.querySelectorAll(".portal-row")];
const validEnvironments = new Set(["production", "dev"]);
const productionUrls = new Map(portalCards.map((card) => {
  const link = card.querySelector(".portal-link");
  return [link, link.getAttribute("href")];
}));
const devBadges = new Map(portalCards.flatMap((card) => {
  const link = card.querySelector(".portal-link");
  if (!link.dataset.devHref) return [];
  const badge = document.createElement("span");
  badge.className = "dev-badge";
  badge.textContent = "Dev";
  badge.hidden = true;
  link.insertBefore(badge, link.querySelector(".visit-icon"));
  return [[link, badge]];
}));
const statusBadges = new Map(portalCards.map((card) => {
  const badge = document.createElement("span");
  badge.className = "app-status";
  badge.hidden = true;
  badge.dataset.state = "checking";
  badge.textContent = "กำลังตรวจสอบ";
  const copy = card.querySelector(".portal-copy");
  copy.insertBefore(badge, copy.querySelector(".portal-domain"));
  return [card, badge];
}));
let statusTimer;
let statusController;
let statusGeneration = 0;

function stopStatusChecks() {
  window.clearTimeout(statusTimer);
  statusController?.abort();
  statusGeneration++;
}

async function refreshDevStatus() {
  if (document.documentElement.dataset.environment !== "dev" || document.hidden) return;
  const generation = statusGeneration;
  const controller = new AbortController();
  statusController = controller;
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  const labels = { up: "ออนไลน์", down: "เข้าไม่ได้", protected: "จำกัดการเข้าถึง" };
  try {
    const response = await fetch("/api/status", { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error("Status API unavailable");
    const data = await response.json();
    if (generation !== statusGeneration) return;
    for (const [card, badge] of statusBadges) {
      const result = data.apps?.[[...card.classList].find((name) => name !== "portal-row")];
      const state = result && labels[result.state] ? result.state : "unknown";
      badge.dataset.state = state;
      badge.textContent = state === "down" && result.httpStatus
        ? `เข้าไม่ได้ · ${result.httpStatus}` : labels[state] || "ตรวจสอบไม่ได้";
      badge.title = `${result?.detail || "ไม่มีผลการตรวจสอบ"}${data.checkedAt ? ` · ตรวจเมื่อ ${new Date(data.checkedAt).toLocaleTimeString("th-TH")}` : ""}`;
    }
  } catch {
    if (generation !== statusGeneration) return;
    for (const badge of statusBadges.values()) {
      badge.dataset.state = "unknown";
      badge.textContent = "ตรวจสอบไม่ได้";
      badge.title = "ระบบตรวจสอบไม่ตอบกลับ ลองเปิดแอปโดยตรงได้";
    }
  } finally {
    window.clearTimeout(timeout);
    if (generation === statusGeneration && document.documentElement.dataset.environment === "dev" && !document.hidden) {
      statusTimer = window.setTimeout(refreshDevStatus, 30000);
    }
  }
}

function setEnvironment(environment, shouldSave = true) {
  if (!validEnvironments.has(environment)) return;
  const isDev = environment === "dev";
  stopStatusChecks();
  document.documentElement.dataset.environment = environment;
  environmentButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.environmentOption === environment));
  });
  portalCards.forEach((card) => {
    card.hidden = card.hasAttribute("data-dev-only") && !isDev;
    const link = card.querySelector(".portal-link");
    const destination = isDev && link.dataset.devHref ? link.dataset.devHref : productionUrls.get(link);
    const badge = devBadges.get(link);
    if (badge) badge.hidden = !isDev;
    const statusBadge = statusBadges.get(card);
    statusBadge.hidden = !isDev;
    statusBadge.dataset.state = "checking";
    statusBadge.textContent = "กำลังตรวจสอบ";
    statusBadge.removeAttribute("title");
    link.setAttribute("href", destination);
    card.querySelector(".portal-domain").textContent = new URL(destination).hostname;
  });
  const count = portalCards.filter((card) => !card.hidden).length;
  document.querySelector("#footer-count").textContent = `${count} places to go`;
  if (isDev) refreshDevStatus();
  if (shouldSave) {
    writeStorage("portal-environment", environment);
    say(`เปลี่ยนเป็นโหมด ${isDev ? "Dev" : "Production"} แล้ว มี ${count} แอป`);
  }
}

function readStorage(key, fallback) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The interface remains usable when storage is unavailable.
  }
}

function say(message) {
  if (!announcement) return;
  announcement.textContent = "";
  window.requestAnimationFrame(() => {
    announcement.textContent = message;
  });
}

function setView(view, shouldSave = true) {
  if (!portalList || !validViews.has(view)) return;
  portalList.dataset.view = view;
  viewButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.viewOption === view));
  });
  if (shouldSave) {
    writeStorage("portal-view", view);
    say(view === "grid" ? "แสดงสองแอปต่อแถวแล้ว" : "แสดงหนึ่งแอปต่อแถวแล้ว");
  }
}

function setTheme(theme, shouldSave = true) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  themeColor?.setAttribute("content", nextTheme === "light" ? "#eef1f2" : "#071018");
  if (themeButton) {
    const label = nextTheme === "dark" ? "เปลี่ยนเป็นธีมสว่าง" : "เปลี่ยนเป็นธีมมืด";
    themeButton.setAttribute("aria-label", label);
    themeButton.title = label;
  }
  if (shouldSave) {
    writeStorage("portal-theme", nextTheme);
    say(nextTheme === "light" ? "เปิดธีมสว่างแล้ว" : "เปิดธีมมืดแล้ว");
  }
}

const storedView = readStorage("portal-view", "rows");
setView(validViews.has(storedView) ? storedView : "rows", false);
setTheme(document.documentElement.dataset.theme, false);
const storedEnvironment = readStorage("portal-environment", "production");
setEnvironment(validEnvironments.has(storedEnvironment) ? storedEnvironment : "production", false);

environmentButtons.forEach((button) => {
  button.addEventListener("click", () => setEnvironment(button.dataset.environmentOption));
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewOption));
});

themeButton?.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

document.addEventListener("visibilitychange", () => {
  stopStatusChecks();
  if (!document.hidden) refreshDevStatus();
});

// Let vertical scrolling and pinch zoom stay native. Reserve screen edges for
// Safari's history gesture, and suppress the link click only after a real drag.
let swipe = null;
let suppressClickUntil = 0;

function resetSwipe() {
  swipe = null;
}

portalList?.addEventListener("touchstart", (event) => {
  resetSwipe();
  if (event.touches.length !== 1) return;
  const touch = event.touches[0];
  if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
  swipe = { id: touch.identifier, x: touch.clientX, y: touch.clientY, dx: 0, dy: 0, axis: null };
}, { passive: true });

portalList?.addEventListener("touchmove", (event) => {
  if (!swipe) return;
  if (event.touches.length !== 1) { resetSwipe(); return; }
  const touch = [...event.touches].find((item) => item.identifier === swipe.id);
  if (!touch) { resetSwipe(); return; }
  swipe.dx = touch.clientX - swipe.x;
  swipe.dy = touch.clientY - swipe.y;
  if (!swipe.axis && Math.max(Math.abs(swipe.dx), Math.abs(swipe.dy)) > 12) {
    swipe.axis = Math.abs(swipe.dx) > Math.abs(swipe.dy) * 1.5 ? "horizontal" : "vertical";
  }
  if (swipe.axis === "horizontal" && event.cancelable) event.preventDefault();
}, { passive: false });

portalList?.addEventListener("touchend", (event) => {
  const gesture = swipe;
  resetSwipe();
  if (!gesture || gesture.axis === "vertical" || event.touches.length) return;
  const touch = [...event.changedTouches].find((item) => item.identifier === gesture.id);
  if (!touch) return;
  const dx = touch.clientX - gesture.x;
  const dy = touch.clientY - gesture.y;
  if (gesture.axis !== "horizontal" && (Math.abs(dx) <= 12 || Math.abs(dx) <= Math.abs(dy) * 1.5)) return;
  suppressClickUntil = Date.now() + 500;
  if (event.cancelable) event.preventDefault();
  const threshold = Math.max(64, Math.min(100, window.innerWidth * 0.18));
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const next = dx < 0 ? "dev" : "production";
  if (next !== document.documentElement.dataset.environment) setEnvironment(next);
}, { passive: false });

portalList?.addEventListener("touchcancel", resetSwipe, { passive: true });
portalList?.addEventListener("click", (event) => {
  if (event.detail !== 0 && Date.now() < suppressClickUntil) {
    event.preventDefault();
    event.stopPropagation();
  }
}, { capture: true });

// A BFCache page resumes its old DOM and compositor, rather than loading again.
// Reset the root scroll offset before restoring the saved position so WebKit
// does not keep a stale upper scroll boundary after returning from another app.
let suspendedScroll = null;
let restoreFrame = null;
try { window.history.scrollRestoration = "manual"; } catch {}

function cancelScrollRestore() {
  if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame);
  restoreFrame = null;
}

window.addEventListener("pagehide", () => {
  cancelScrollRestore();
  resetSwipe();
  suppressClickUntil = 0;
  stopStatusChecks();
  suspendedScroll = { x: Math.max(0, window.scrollX), y: Math.max(0, window.scrollY) };
  try {
    window.history.replaceState({ ...window.history.state, portalScroll: suspendedScroll }, "");
  } catch {}
});

window.addEventListener("pageshow", (event) => {
  resetSwipe();
  suppressClickUntil = 0;
  cancelScrollRestore();
  const historyReturn = event.persisted || window.performance?.getEntriesByType("navigation")[0]?.type === "back_forward";
  if (historyReturn) {
    const position = suspendedScroll || window.history.state?.portalScroll;
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
      const root = document.scrollingElement || document.documentElement;
      // body must not retain an independent offset while the root is scrolling.
      if (root !== document.body) document.body.scrollTop = 0;
      window.scrollTo({ left: 0, top: 0, behavior: "instant" });
      restoreFrame = window.requestAnimationFrame(() => {
        restoreFrame = null;
        const maxY = Math.max(0, root.scrollHeight - window.innerHeight);
        window.scrollTo({ left: position.x, top: Math.max(0, Math.min(position.y, maxY)), behavior: "instant" });
      });
    }
  }
  stopStatusChecks();
  refreshDevStatus();
});

// A user gesture takes precedence over a queued restoration frame.
window.addEventListener("touchstart", cancelScrollRestore, { passive: true });
window.addEventListener("pointerdown", cancelScrollRestore, { passive: true });
window.addEventListener("wheel", cancelScrollRestore, { passive: true });
