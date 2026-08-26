"use strict";

(() => {
  const MODES = new Set(["auto", "high", "low"]);
  const params = new URL(location.href).searchParams;
  const requested = params.get("render");
  const mode = MODES.has(requested) ? requested : "native";

  function normalizeDpr(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 1;
  }

  function pixelRatio({ width = window.innerWidth, devicePixelRatio = window.devicePixelRatio || 1 } = {}) {
    const dpr = normalizeDpr(devicePixelRatio);
    if (mode === "native") return dpr;
    const mobile = Number.isFinite(Number(width)) ? Number(width) < 720 : window.innerWidth < 720;
    if (mode === "auto") return Math.min(dpr, mobile ? 1 : 1.45);
    if (mode === "high") return Math.min(dpr, mobile ? 1.25 : 1.8);
    return Math.min(dpr, 0.85);
  }

  window.ProjectMapRenderDensity = Object.freeze({
    version: 1,
    mode,
    pixelRatio,
    snapshot(options = {}) {
      const dpr = normalizeDpr(options.devicePixelRatio ?? window.devicePixelRatio ?? 1);
      const width = Number.isFinite(Number(options.width)) ? Number(options.width) : window.innerWidth;
      const ratio = pixelRatio({ width, devicePixelRatio: dpr });
      return {
        mode,
        devicePixelRatio: dpr,
        pixelRatio: ratio,
        mobile: width < 720,
      };
    },
  });
})();
