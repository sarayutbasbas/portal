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

function setEnvironment(environment, shouldSave = true) {
  if (!validEnvironments.has(environment)) return;
  const isDev = environment === "dev";
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
    link.setAttribute("href", destination);
    card.querySelector(".portal-domain").textContent = new URL(destination).hostname;
  });
  const count = portalCards.filter((card) => !card.hidden).length;
  document.querySelector("#footer-count").textContent = `${count} places to go`;
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
