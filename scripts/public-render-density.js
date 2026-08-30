"use strict";

(() => {
  function normalizeDpr(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 1;
  }

  function pixelRatio({ devicePixelRatio = window.devicePixelRatio || 1 } = {}) {
    return normalizeDpr(devicePixelRatio);
  }

  window.ProjectMapRenderDensity = Object.freeze({
    version: 2,
    mode: "native",
    pixelRatio,
    snapshot(options = {}) {
      const dpr = normalizeDpr(options.devicePixelRatio ?? window.devicePixelRatio ?? 1);
      const width = Number.isFinite(Number(options.width)) ? Number(options.width) : window.innerWidth;
      return {
        mode: "native",
        devicePixelRatio: dpr,
        pixelRatio: dpr,
        mobile: width < 720,
      };
    },
  });
})();
