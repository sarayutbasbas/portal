const portalList = document.querySelector("#portal-list");
const viewButtons = [...document.querySelectorAll("[data-view-option]")];
const themeButton = document.querySelector("#theme-button");
const announcement = document.querySelector("#portal-announcement");
const themeColor = document.querySelector('meta[name="theme-color"]');
const validViews = new Set(["rows", "grid"]);

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

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewOption));
});

themeButton?.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
