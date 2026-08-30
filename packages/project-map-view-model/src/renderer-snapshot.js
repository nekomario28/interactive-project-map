function finiteDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 1000) / 1000 : 0;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function cleanId(value, max = 160) {
  const text = typeof value === "string" ? value.trim().slice(0, max) : "";
  return text || null;
}

export function createRendererSnapshot(input = {}) {
  const rendererId = cleanId(input.rendererId);
  if (!rendererId) throw new TypeError("rendererId is required");

  const viewportWidth = finiteDimension(input.viewport?.width);
  const viewportHeight = finiteDimension(input.viewport?.height);
  const backingWidth = finiteDimension(input.backingStore?.width);
  const backingHeight = finiteDimension(input.backingStore?.height);
  const ratioX = viewportWidth > 0 ? backingWidth / viewportWidth : 0;
  const ratioY = viewportHeight > 0 ? backingHeight / viewportHeight : 0;
  const pixelRatio = finiteDimension(Math.max(ratioX, ratioY));

  const capabilities = {};
  for (const [key, value] of Object.entries(input.capabilities || {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (/^[a-z][A-Za-z0-9]{0,39}$/.test(key)) capabilities[key] = value === true;
  }

  return Object.freeze({
    version: 1,
    rendererId,
    styleId: cleanId(input.styleId),
    experimental: input.experimental === true,
    semantic: Object.freeze({
      repositories: nonNegativeInteger(input.semantic?.repositories),
      groups: nonNegativeInteger(input.semantic?.groups),
    }),
    selectedId: cleanId(input.selectedId, 180),
    capabilities: Object.freeze(capabilities),
    viewport: Object.freeze({ width: viewportWidth, height: viewportHeight }),
    backingStore: Object.freeze({ width: backingWidth, height: backingHeight, pixelRatio }),
  });
}
