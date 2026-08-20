export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function hashText(text) {
  const valueText = String(text);
  let value = 2166136261;
  for (let index = 0; index < valueText.length; index += 1) {
    value ^= valueText.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function wrapAngle(angle) {
  let value = Number(angle) % TAU;
  if (value > Math.PI) value -= TAU;
  if (value < -Math.PI) value += TAU;
  return value;
}

export function deterministicScatter(id, index, count, options = {}) {
  const safeCount = Math.max(1, Number.isFinite(count) ? Math.floor(count) : 1);
  const safeIndex = Math.max(0, Number.isFinite(index) ? Math.floor(index) : 0);
  const innerRadius = Number.isFinite(options.innerRadius) ? options.innerRadius : 42;
  const radialSpan = Number.isFinite(options.radialSpan) ? options.radialSpan : 265;
  const angleJitter = Number.isFinite(options.angleJitter) ? options.angleJitter : 0.7;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const jitter = (hashText(id) % 1000) / 1000;
  const angle = safeIndex * golden + jitter * angleJitter;
  const radius = innerRadius + Math.sqrt((safeIndex + 1) / safeCount) * radialSpan;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
