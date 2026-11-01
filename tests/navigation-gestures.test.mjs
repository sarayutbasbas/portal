import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInContext, createContext } from "node:vm";
import { parseHTML } from "linkedom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");

function mount({ historyState = null, navigationType = "navigate", standalone = false, animated = false, reducedMotion = false } = {}) {
  const { document, window: domWindow } = parseHTML(html);
  const events = new EventTarget();
  const frames = new Map();
  const timers = new Map();
  const values = new Map();
  const scrolls = [];
  const animations = [];
  let nextId = 0;
  let statusRequests = 0;
  const history = {
    state: historyState,
    scrollRestoration: "auto",
    replaceState(state) { this.state = state; },
  };
  const window = {
    innerWidth: 390, innerHeight: 800, scrollX: 0, scrollY: 0, history,
    matchMedia: () => ({ matches: reducedMotion }),
    performance: { getEntriesByType: () => [{ type: navigationType }] },
    addEventListener: (...args) => events.addEventListener(...args),
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    setTimeout(callback, ms) { timers.set(++nextId, { callback, ms }); return nextId; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { frames.set(++nextId, callback); return nextId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    scrollTo(position) { scrolls.push(position); this.scrollX = position.left; this.scrollY = position.top; },
  };
  document.documentElement.scrollHeight = 2600;
  document.body.scrollTop = 0;
  document.documentElement.dataset.standalone = String(standalone);
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  Object.defineProperty(document, "activeElement", { value: document.body, writable: true });
  const shell = document.querySelector(".page-shell");
  Object.assign(shell, { scrollTop: 0, scrollLeft: 0, scrollHeight: 2600, clientHeight: 800 });
  const list = document.querySelector("#portal-list");
  const stage = document.querySelector(".portal-stage");
  list.getBoundingClientRect = () => ({ height: 1700, width: 360 });
  stage.getBoundingClientRect = () => ({ height: 1700, width: 360 });
  if (animated) {
    const animate = (keyframes, timing) => {
      let resolve;
      const animation = { keyframes, timing, cancelled: false, finished: new Promise((done) => { resolve = done; }),
        finish: () => resolve(), cancel() { this.cancelled = true; resolve(); } };
      animations.push(animation); return animation;
    };
    list.animate = animate;
    const cloneNode = list.cloneNode.bind(list);
    list.cloneNode = (...args) => { const clone = cloneNode(...args); clone.animate = animate; return clone; };
  }
  const context = createContext({ document, window, URL, AbortController, fetch: async () => {
    statusRequests++;
    return { ok: true, json: async () => ({ apps: {}, checkedAt: new Date().toISOString() }) };
  } });
  runInContext(script, context);
  function dispatch(type, properties = {}) {
    const event = new domWindow.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, properties);
    list.dispatchEvent(event);
    return event;
  }
  function lifecycle(type, properties = {}) {
    const event = new Event(type);
    Object.assign(event, properties);
    events.dispatchEvent(event);
  }
  function touch(type, x, y, extra = {}) {
    const point = { identifier: 1, clientX: x, clientY: y };
    return dispatch(type, { touches: type === "touchend" ? [] : [point], changedTouches: [point], ...extra });
  }
  function flushFrames() {
    const queued = [...frames.values()]; frames.clear(); queued.forEach((callback) => callback());
  }
  function visibility(hidden) {
    Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
    document.dispatchEvent(new domWindow.Event("visibilitychange"));
  }
  return { document, window, shell, list, animations, values, scrolls, frames, timers, touch, dispatch, lifecycle, flushFrames, visibility,
    get statusRequests() { return statusRequests; } };
}

test("swiping left selects Dev, right selects Production; Movie and destinations follow", () => {
  const app = mount();
  app.touch("touchstart", 290, 300);
  assert.equal(app.touch("touchmove", 180, 305).defaultPrevented, true);
  app.touch("touchend", 160, 305);
  assert.equal(app.document.documentElement.dataset.environment, "dev");
  assert.equal(app.values.get("portal-environment"), "dev");
  assert.equal(app.document.querySelector(".movie").hidden, false);
  assert.equal(app.document.querySelector(".games a").getAttribute("href"), "https://bn-games.basnana.com/");
  app.touch("touchstart", 80, 300);
  app.touch("touchmove", 220, 304);
  app.touch("touchend", 230, 304);
  assert.equal(app.document.documentElement.dataset.environment, "production");
  assert.equal(app.document.querySelector(".movie").hidden, true);
  assert.equal(app.document.querySelector(".games a").getAttribute("href"), "https://games.basnana.com");
});

test("vertical scrolling, diagonal drags, screen-edge gestures and pinch do not change mode", () => {
  for (const [start, end, extra] of [
    [[180, 500], [190, 180]], [[180, 500], [80, 380]],
    [[10, 300], [150, 300]], [[380, 300], [100, 300]],
    [[200, 300], [80, 300], { touches: [{ identifier: 1, clientX: 80, clientY: 300 }, { identifier: 2, clientX: 250, clientY: 300 }] }],
  ]) {
    const app = mount();
    app.touch("touchstart", ...start);
    assert.equal(app.touch("touchmove", ...end, extra).defaultPrevented, false);
    app.touch("touchend", ...end);
    assert.equal(app.document.documentElement.dataset.environment, "production");
  }
});

test("taps remain clickable, real swipes suppress ghost clicks but not keyboard activation", () => {
  const app = mount();
  app.touch("touchstart", 200, 300); app.touch("touchend", 202, 302);
  assert.equal(app.dispatch("click", { detail: 1 }).defaultPrevented, false);
  app.touch("touchstart", 290, 300); app.touch("touchmove", 170, 302); app.touch("touchend", 160, 302);
  assert.equal(app.dispatch("click", { detail: 1 }).defaultPrevented, true);
  assert.equal(app.dispatch("click", { detail: 0 }).defaultPrevented, false);
});

test("short drags and cancelled gestures never switch modes; quick swipes still work", () => {
  const app = mount();
  app.touch("touchstart", 200, 300); app.touch("touchmove", 175, 300); app.touch("touchend", 175, 300);
  assert.equal(app.document.documentElement.dataset.environment, "production");
  app.touch("touchstart", 290, 300); app.touch("touchmove", 100, 300); app.dispatch("touchcancel"); app.touch("touchend", 100, 300);
  assert.equal(app.document.documentElement.dataset.environment, "production");
  app.touch("touchstart", 290, 300); app.touch("touchend", 100, 300);
  assert.equal(app.document.documentElement.dataset.environment, "dev");
});

test("installed app Back restores its own scroll area and releases the previous card focus", () => {
  const app = mount({ standalone: true });
  app.shell.scrollTop = 900;
  const link = app.document.querySelector(".house-rao a");
  let blurred = 0;
  link.blur = () => { blurred++; app.document.activeElement = app.document.body; };
  app.document.activeElement = link;
  app.lifecycle("pagehide", { persisted: true });
  app.shell.scrollTop = 0;
  app.window.scrollY = 240;
  app.lifecycle("pageshow", { persisted: true });
  assert.equal(app.window.history.scrollRestoration, "manual");
  assert.equal(app.scrolls[0].top, 0);
  app.flushFrames();
  assert.equal(app.shell.scrollTop, 900);
  assert.equal(app.window.scrollY, 0);
  assert.equal(blurred, 1);
  assert.equal(app.scrolls.length, 1, "never jumps the document back down");
  app.shell.scrollTop = 0;
  assert.equal(app.shell.scrollTop, 0);
});

test("non-cached installed app Back restores history state within the app scroll bounds", () => {
  const app = mount({ standalone: true, historyState: { portalScroll: { x: 0, y: 2400 } }, navigationType: "back_forward" });
  app.lifecycle("pageshow", { persisted: false });
  app.flushFrames();
  assert.equal(app.shell.scrollTop, 1800);
});

test("fresh visits do not jump; user touch cancels a pending Back restoration", () => {
  const app = mount({ standalone: true });
  app.lifecycle("pageshow", { persisted: false }); app.flushFrames();
  assert.equal(app.scrolls.length, 0);
  app.shell.scrollTop = 600; app.lifecycle("pagehide"); app.lifecycle("pageshow", { persisted: true });
  app.lifecycle("touchstart"); app.flushFrames();
  assert.equal(app.shell.scrollTop, 600);
});

test("installed app recovers when an external browser closes without a pageshow event", () => {
  const app = mount({ standalone: true });
  app.shell.scrollTop = 760;
  app.visibility(true);
  app.shell.scrollTop = 125;
  app.visibility(false);
  app.flushFrames();
  assert.equal(app.shell.scrollTop, 760);
  assert.equal(app.window.scrollY, 0);
});

test("ordinary Safari keeps native Back restoration without a scripted scroll jump", () => {
  const app = mount();
  app.window.scrollY = 640; app.lifecycle("pagehide"); app.lifecycle("pageshow", { persisted: true });
  app.flushFrames();
  assert.equal(app.window.history.scrollRestoration, "auto");
  assert.equal(app.scrolls.length, 0);
  assert.equal(app.window.scrollY, 640);
});

test("mode changes slide old and new lists at full opacity and clean up the snapshot", async () => {
  const app = mount({ animated: true });
  app.touch("touchstart", 290, 300); app.touch("touchend", 100, 300);
  assert.equal(app.animations.length, 2);
  assert.equal(app.document.documentElement.dataset.environment, "dev");
  const snapshot = app.document.querySelector(".portal-snapshot");
  assert.ok(snapshot);
  assert.equal(snapshot.getAttribute("aria-hidden"), "true");
  assert.equal(snapshot.inert, true);
  assert.equal(snapshot.querySelector(".movie").hidden, true);
  assert.equal(app.document.querySelector("#portal-list .movie").hidden, false);
  for (const animation of app.animations) {
    assert.ok(animation.keyframes.every((frame) => !Object.hasOwn(frame, "opacity")));
    animation.finish();
  }
  await new Promise(setImmediate);
  assert.equal(app.document.querySelector(".portal-snapshot"), null);
  assert.equal(app.document.querySelector(".portal-stage").style.minHeight, "");
});

test("rapid reverse swipes and pagehide cancel old animations without leaving overlays", async () => {
  const app = mount({ animated: true });
  app.touch("touchstart", 290, 300); app.touch("touchend", 100, 300);
  app.touch("touchstart", 80, 300); app.touch("touchend", 250, 300);
  assert.equal(app.document.querySelectorAll(".portal-snapshot").length, 1);
  assert.ok(app.animations.slice(0, 2).every((animation) => animation.cancelled));
  assert.equal(app.document.documentElement.dataset.environment, "production");
  app.lifecycle("pagehide");
  await new Promise(setImmediate);
  assert.equal(app.document.querySelector(".portal-snapshot"), null);
});

test("reduced-motion preference switches directly without starting animations", () => {
  const app = mount({ animated: true, reducedMotion: true });
  app.touch("touchstart", 290, 300); app.touch("touchend", 100, 300);
  assert.equal(app.document.documentElement.dataset.environment, "dev");
  assert.equal(app.animations.length, 0);
});
