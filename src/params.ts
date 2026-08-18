export function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const value = url.searchParams.get(key);
  if (value === null || value.trim() === "") return fallback;

  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

export function boolParam(url: URL, key: string, fallback: boolean): boolean {
  const raw = url.searchParams.get(key);
  if (raw == null || raw.trim() === "") return fallback;

  const value = raw.toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}
