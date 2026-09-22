const assert = require("node:assert/strict");
const { test } = require("node:test");

function loadSubject() {
  try {
    return require("./css-background-contrast.ts");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") return {};
    throw error;
  }
}

test("exports the contrast classifier used by the component", () => {
  const subject = loadSubject();

  assert.equal(typeof subject.isCssColorDark, "function");
});

test("classifies common computed CSS colors", () => {
  const { isCssColorDark } = loadSubject();

  const cases = [
    ["rgb(255, 255, 255)", false],
    ["rgb(0 0 0)", true],
    ["#ffffff", false],
    ["#000000", true],
    ["oklch(0.99 0.003 260)", false],
    ["oklch(0.12 0.03 255)", true],
    ["oklch(0.9 none none)", false],
    ["oklab(90% 0% 0%)", false],
    ["lab(90% 0% 0%)", false],
    ["color(srgb 1 1 1)", false],
    ["color(display-p3 1 1 1)", false],
    ["color(display-p3 0 0 0)", true],
    ["color(display-p3 0 0.45 0.85)", true],
    ["transparent", null],
    ["rgba(0, 0, 0, 0)", null],
    ["oklch(nope 0 0)", null],
  ];

  for (const [color, expected] of cases) {
    assert.equal(isCssColorDark(color), expected, color);
  }
});

test("composites translucent backgrounds with their ancestors", () => {
  const { resolveBackgroundIsDark } = loadSubject();

  assert.equal(typeof resolveBackgroundIsDark, "function");

  assert.equal(
    resolveBackgroundIsDark(["rgba(0, 0, 0, 0.2)", "rgb(255, 255, 255)"], true),
    false,
  );
  assert.equal(
    resolveBackgroundIsDark(
      ["rgba(255, 255, 255, 0.2)", "rgb(0, 0, 0)"],
      false,
    ),
    true,
  );
  assert.equal(
    resolveBackgroundIsDark(["transparent", "rgb(0, 0, 0)"], false),
    true,
  );
  assert.equal(
    resolveBackgroundIsDark(
      ["color(display-p3 0 0 0 / 0.7)", "rgb(255 255 255)"],
      false,
    ),
    true,
  );
  assert.equal(
    resolveBackgroundIsDark(
      ["color(display-p3 1 1 1 / 0.2)", "color(display-p3 0 0 0)"],
      false,
    ),
    true,
  );
});

test("respects explicit themes and lets auto inspect the background", () => {
  const { resolveThemeIsDark } = loadSubject();

  assert.equal(typeof resolveThemeIsDark, "function");

  assert.equal(resolveThemeIsDark("dark", ["rgb(255, 255, 255)"], false), true);
  assert.equal(resolveThemeIsDark("light", ["rgb(0, 0, 0)"], true), false);
  assert.equal(resolveThemeIsDark("auto", ["rgb(0, 0, 0)"], false), true);
  assert.equal(resolveThemeIsDark("auto", ["transparent"], true), true);
});

test("derives a transparent document canvas from color-scheme, not OS preference alone", () => {
  const { resolveCanvasFallbackIsDark } = loadSubject();

  assert.equal(typeof resolveCanvasFallbackIsDark, "function");
  assert.equal(resolveCanvasFallbackIsDark("normal", true), false);
  assert.equal(resolveCanvasFallbackIsDark("light", true), false);
  assert.equal(resolveCanvasFallbackIsDark("dark", false), true);
  assert.equal(resolveCanvasFallbackIsDark("light dark", true), true);
});

test("keeps sampling while an ancestor background transition is active", () => {
  const { subscribeToBackgroundChanges } = loadSubject();

  assert.equal(typeof subscribeToBackgroundChanges, "function");

  const originalWindow = global.window;
  const originalMutationObserver = global.MutationObserver;
  const frames = new Map();
  let nextFrame = 1;
  let notifications = 0;

  const createTarget = () => {
    const listeners = new Map();
    return {
      addEventListener(type, listener) {
        const handlers = listeners.get(type) ?? new Set();
        handlers.add(listener);
        listeners.set(type, handlers);
      },
      removeEventListener(type, listener) {
        listeners.get(type)?.delete(listener);
      },
      emit(type, target = this) {
        for (const listener of listeners.get(type) ?? [])
          listener({ type, target });
      },
    };
  };

  const fakeWindow = createTarget();
  fakeWindow.requestAnimationFrame = (callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  };
  fakeWindow.cancelAnimationFrame = (id) => frames.delete(id);
  fakeWindow.matchMedia = () => createTarget();
  global.window = fakeWindow;
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
  };

  const ancestor = createTarget();
  const descendant = createTarget();
  const newAncestor = createTarget();
  let currentAncestors = [ancestor];
  let hasRunningAnimation = true;
  ancestor.getAnimations = () =>
    hasRunningAnimation ? [{ playState: "running" }] : [];
  const unsubscribe = subscribeToBackgroundChanges(
    () => {
      notifications += 1;
    },
    () => currentAncestors,
  );

  const runNextFrame = () => {
    const [id, callback] = frames.entries().next().value;
    frames.delete(id);
    callback();
  };

  assert.equal(frames.size, 1);
  runNextFrame();
  hasRunningAnimation = false;
  runNextFrame();

  ancestor.emit("animationstart", descendant);
  assert.equal(frames.size, 0);

  ancestor.emit("transitionrun");
  runNextFrame();
  runNextFrame();
  ancestor.emit("transitionend");
  runNextFrame();

  assert.equal(notifications, 5);
  assert.equal(frames.size, 0);

  ancestor.emit("transitionrun");
  currentAncestors = [newAncestor];
  ancestor.emit("transitionend");
  runNextFrame();
  assert.equal(frames.size, 0);

  unsubscribe();
  global.window = originalWindow;
  global.MutationObserver = originalMutationObserver;
});
