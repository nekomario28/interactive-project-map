export function createProjectMapTransferableStateApi() {
  const STATUS_VALUES = Object.freeze(["original", "fork", "archived", "contributed"]);
  const STATUS_ALIASES = Object.freeze({ o: "original", f: "fork", a: "archived", c: "contributed" });

  function paramsFrom(value) {
    if (value instanceof URLSearchParams) return new URLSearchParams(value);
    if (value instanceof URL) return new URLSearchParams(value.searchParams);
    const text = String(value || "");
    try {
      return new URL(text).searchParams;
    } catch {
      return new URLSearchParams(text.startsWith("?") ? text.slice(1) : text);
    }
  }

  function normalizeStatuses(value) {
    const source = Array.isArray(value) ? value : String(value || "").split(",");
    const statuses = source
      .map((item) => STATUS_ALIASES[item] || item)
      .filter((item) => STATUS_VALUES.includes(item));
    return [...new Set(statuses.length ? statuses : STATUS_VALUES)];
  }

  function parse(value) {
    const params = paramsFrom(value);
    const focus = String(params.get("focus") || "").slice(0, 180);
    const depth = Math.max(1, Math.min(3, Math.round(Number(params.get("depth")) || 1)));
    return {
      username: String(params.get("username") || "").slice(0, 39),
      q: String(params.get("q") || "").slice(0, 160),
      statuses: normalizeStatuses(params.get("status")),
      motionOff: params.get("motion") === "off",
      activity: params.get("activity") === "1",
      focus: focus || "",
      depth: focus ? depth : 1,
      quality: params.get("quality") === "1",
    };
  }

  function applyToUrl(urlValue, state = {}, options = {}) {
    const url = urlValue instanceof URL ? new URL(urlValue.toString()) : new URL(String(urlValue));
    const availableStatuses = normalizeStatuses(options.availableStatuses || STATUS_VALUES);
    const statuses = normalizeStatuses(state.statuses || STATUS_VALUES).filter((value) => availableStatuses.includes(value));
    const effectiveStatuses = statuses.length ? statuses : availableStatuses;
    const defaults = effectiveStatuses.length === availableStatuses.length
      && availableStatuses.every((value) => effectiveStatuses.includes(value));

    const username = String(state.username || "").slice(0, 39);
    if (username) url.searchParams.set("username", username);
    else url.searchParams.delete("username");

    const q = String(state.q || "").slice(0, 160);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");

    if (defaults) url.searchParams.delete("status");
    else url.searchParams.set("status", STATUS_VALUES.filter((value) => effectiveStatuses.includes(value)).join(","));

    if (state.motionOff === true) url.searchParams.set("motion", "off");
    else url.searchParams.delete("motion");

    if (state.activity === true) url.searchParams.set("activity", "1");
    else url.searchParams.delete("activity");

    const focus = String(state.focus || "").slice(0, 180);
    if (focus) {
      url.searchParams.set("focus", focus);
      url.searchParams.set("depth", String(Math.max(1, Math.min(3, Math.round(Number(state.depth) || 1)))));
    } else {
      url.searchParams.delete("focus");
      url.searchParams.delete("depth");
    }

    if (state.quality === true) url.searchParams.set("quality", "1");
    else url.searchParams.delete("quality");
    return url;
  }

  function transfer(sourceValue, targetValue, overrides = {}, options = {}) {
    const state = { ...parse(sourceValue), ...overrides };
    return applyToUrl(targetValue, state, options);
  }

  return Object.freeze({
    version: 1,
    STATUS_VALUES,
    normalizeStatuses,
    parse,
    applyToUrl,
    transfer,
  });
}

export const ProjectMapTransferableState = createProjectMapTransferableStateApi();
