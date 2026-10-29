// A jsdom window for render tests: React DOM and react-native-web need `document`.
const { JSDOM } = require("jsdom");

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "https://app.test/",
  pretendToBeVisual: true,
});
const { window } = dom;
// A phone-sized viewport, so screens that lay out from the window height get sane numbers.
window.innerWidth = 390;
window.innerHeight = 844;
// The document size follows the window, so a test can resize it (set innerWidth, then dispatch "resize").
for (const [key, source] of [
  ["clientWidth", "innerWidth"],
  ["clientHeight", "innerHeight"],
]) {
  Object.defineProperty(window.document.documentElement, key, {
    configurable: true,
    get: () => window[source],
  });
}

// Expose the window's globals (ShadowRoot, Event classes, CSS, ...) the way jest-environment-jsdom does.
const ALWAYS = new Set([
  "window",
  "document",
  "navigator",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]);
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis && !ALWAYS.has(key)) continue;
  try {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: () => window[key],
      set: (value) =>
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }),
    });
  } catch {
    // Some window properties cannot be redefined; the ones components need can.
  }
}
if (!globalThis.navigator || !globalThis.navigator.userAgent) {
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.ResizeObserver = globalThis.ResizeObserver;
window.matchMedia =
  window.matchMedia ||
  (() => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
module.exports = { dom, window };

// React's dev build writes component timings to devtools tracks (console.timeStamp +
// performance.measure) and walks every prop to do it. That can throw on stubbed values and
// leaves React mid-commit, so switch the tracks off.
console.timeStamp = undefined;
