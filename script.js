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
