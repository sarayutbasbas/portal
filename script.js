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

function rows() {
  return portalList ? [...portalList.querySelectorAll(".portal-row")] : [];
}

function saveOrder() {
  writeStorage("portal-order", JSON.stringify(rows().map((row) => row.dataset.appId)));
}

function restoreOrder() {
  if (!portalList) return;
  let order;
  try {
    order = JSON.parse(readStorage("portal-order", "[]"));
  } catch {
    order = [];
  }
  if (!Array.isArray(order)) return;

  const byId = new Map(rows().map((row) => [row.dataset.appId, row]));
  order.forEach((id) => {
    const row = byId.get(id);
    if (row) {
      portalList.append(row);
      byId.delete(id);
    }
  });
  byId.forEach((row) => portalList.append(row));
}

function moveWithKeyboard(event, row) {
  const items = rows();
  const currentIndex = items.indexOf(row);
  const columns = portalList?.dataset.view === "grid" ? 2 : 1;
  const offsets = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -columns,
    ArrowDown: columns,
  };
  const offset = offsets[event.key];
  if (!offset) return;

  event.preventDefault();
  const targetIndex = Math.max(0, Math.min(items.length - 1, currentIndex + offset));
  if (targetIndex === currentIndex) return;

  const target = items[targetIndex];
  if (targetIndex < currentIndex) {
    portalList.insertBefore(row, target);
  } else {
    portalList.insertBefore(row, target.nextElementSibling);
  }
  saveOrder();
  row.querySelector(".drag-handle")?.focus();
  const name = row.querySelector(".portal-name")?.textContent?.trim() ?? "แอป";
  say(`ย้าย ${name} ไปตำแหน่งที่ ${targetIndex + 1} แล้ว`);
}

let draggedRow = null;
let activePointerId = null;

function finishPointerSort(handle) {
  if (!draggedRow) return;
  const name = draggedRow.querySelector(".portal-name")?.textContent?.trim() ?? "แอป";
  draggedRow.classList.remove("is-dragging");
  document.body.classList.remove("is-sorting");
  saveOrder();
  say(`บันทึกลำดับใหม่ของ ${name} แล้ว`);
  try {
    handle.releasePointerCapture(activePointerId);
  } catch {}
  draggedRow = null;
  activePointerId = null;
}

function setupSorting() {
  rows().forEach((row) => {
    const handle = row.querySelector(".drag-handle");
    if (!handle) return;

    handle.addEventListener("keydown", (event) => moveWithKeyboard(event, row));

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType !== "touch") return;
      event.preventDefault();
      draggedRow = row;
      activePointerId = event.pointerId;
      handle.setPointerCapture(event.pointerId);
      row.classList.add("is-dragging");
      document.body.classList.add("is-sorting");
    });

    handle.addEventListener("pointermove", (event) => {
      if (draggedRow !== row || activePointerId !== event.pointerId || !portalList) return;
      event.preventDefault();

      if (event.clientY < 72) window.scrollBy(0, -10);
      if (event.clientY > window.innerHeight - 72) window.scrollBy(0, 10);

      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".portal-row");
      if (!target || target === draggedRow || target.parentElement !== portalList) return;

      const bounds = target.getBoundingClientRect();
      const isGrid = portalList.dataset.view === "grid";
      const after = isGrid
        ? event.clientY > bounds.top + bounds.height * 0.7 ||
          (event.clientY >= bounds.top + bounds.height * 0.3 && event.clientX > bounds.left + bounds.width / 2)
        : event.clientY > bounds.top + bounds.height / 2;

      if (after) {
        if (target.nextElementSibling !== draggedRow) portalList.insertBefore(draggedRow, target.nextElementSibling);
      } else if (target.previousElementSibling !== draggedRow) {
        portalList.insertBefore(draggedRow, target);
      }
    });

    handle.addEventListener("pointerup", () => finishPointerSort(handle));
    handle.addEventListener("pointercancel", () => finishPointerSort(handle));
  });
}

const storedView = readStorage("portal-view", "rows");
setView(validViews.has(storedView) ? storedView : "rows", false);
setTheme(document.documentElement.dataset.theme, false);
restoreOrder();
setupSorting();

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewOption));
});

themeButton?.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
