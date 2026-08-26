import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TOP_LEVEL_KEYS = ["cross_surface_policy", "status", "surfaces", "version"];
const SURFACE_KEYS = ["file", "observed_consumed_roles", "observed_unconsumed_roles", "root_roles", "theme_overrides"];
const CROSS_POLICY_KEYS = ["raw_color_literals", "reduced_motion_required", "role_usage_change_requires_review", "shared_semantic_role_names_required", "value_equality_required"];
const SURFACE_NAMES = ["shared_2d", "threejs_cosmic"];

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b, "en"));
}

function assertClosedKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = sorted(Object.keys(value));
  const expected = sorted(allowed);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} keys must be exactly ${expected.join(", ")}; got ${actual.join(", ")}`);
  }
}

function extractBlock(css, selector, label) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${label}: missing ${selector} block`);
  const bodyStart = start + `${selector} {`.length;
  const end = css.indexOf("}", bodyStart);
  if (end < 0) throw new Error(`${label}: unterminated ${selector} block`);
  return css.slice(bodyStart, end);
}

function extractCustomProperties(block) {
  const entries = [...block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)];
  return Object.fromEntries(entries.map((match) => [match[1], match[2].trim()]));
}

function referencedCustomProperties(css) {
  return new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)].map((match) => match[1]));
}

function rawColorLiteralCount(css) {
  return [...css.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi)].length;
}

function assertStringMap(actual, expected, label) {
  const actualKeys = sorted(Object.keys(actual));
  const expectedKeys = sorted(Object.keys(expected));
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${label}: role names drifted; expected ${expectedKeys.join(", ")}; got ${actualKeys.join(", ")}`);
  }
  for (const key of expectedKeys) {
    if (actual[key] !== expected[key]) throw new Error(`${label}: ${key} expected ${expected[key]} but got ${actual[key]}`);
  }
}

function assertRoleUsage(surfaceName, surface, css) {
  const roleNames = sorted(Object.keys(surface.root_roles));
  const expectedConsumed = sorted(surface.observed_consumed_roles);
  const expectedUnconsumed = sorted(surface.observed_unconsumed_roles);
  if (JSON.stringify(surface.observed_consumed_roles) !== JSON.stringify(expectedConsumed)) throw new Error(`${surfaceName}: observed_consumed_roles must be sorted`);
  if (JSON.stringify(surface.observed_unconsumed_roles) !== JSON.stringify(expectedUnconsumed)) throw new Error(`${surfaceName}: observed_unconsumed_roles must be sorted`);
  const declaredUsage = new Set([...expectedConsumed, ...expectedUnconsumed]);
  if (declaredUsage.size !== roleNames.length || JSON.stringify(sorted(declaredUsage)) !== JSON.stringify(roleNames)) {
    throw new Error(`${surfaceName}: consumed + unconsumed role lists must partition root_roles exactly`);
  }
  const overlap = expectedConsumed.filter((role) => expectedUnconsumed.includes(role));
  if (overlap.length) throw new Error(`${surfaceName}: role usage lists overlap: ${overlap.join(", ")}`);
  const refs = referencedCustomProperties(css);
  const actualConsumed = roleNames.filter((role) => refs.has(role));
  const actualUnconsumed = roleNames.filter((role) => !refs.has(role));
  if (JSON.stringify(actualConsumed) !== JSON.stringify(expectedConsumed)) {
    throw new Error(`${surfaceName}: semantic role consumption changed; expected ${expectedConsumed.join(", ") || "none"}; got ${actualConsumed.join(", ") || "none"}`);
  }
  if (JSON.stringify(actualUnconsumed) !== JSON.stringify(expectedUnconsumed)) {
    throw new Error(`${surfaceName}: semantic role non-consumption changed; grammar review is required`);
  }
  return { consumed: actualConsumed.length, unconsumed: actualUnconsumed.length };
}

function validateGrammarShape(grammar) {
  assertClosedKeys(grammar, TOP_LEVEL_KEYS, "grammar");
  if (grammar.version !== 1) throw new Error(`grammar.version must be 1`);
  if (grammar.status !== "measured-reference-detection-only") throw new Error(`grammar.status must remain measured-reference-detection-only`);
  assertClosedKeys(grammar.surfaces, SURFACE_NAMES, "grammar.surfaces");
  for (const name of SURFACE_NAMES) {
    const surface = grammar.surfaces[name];
    const expectedKeys = name === "shared_2d" ? SURFACE_KEYS : SURFACE_KEYS.filter((key) => key !== "theme_overrides");
    assertClosedKeys(surface, expectedKeys, `grammar.surfaces.${name}`);
    if (typeof surface.file !== "string" || !surface.file.endsWith(".css")) throw new Error(`${name}: file must be a CSS path`);
    if (!surface.root_roles || typeof surface.root_roles !== "object" || Array.isArray(surface.root_roles)) throw new Error(`${name}: root_roles must be an object`);
    if (!Array.isArray(surface.observed_consumed_roles) || !Array.isArray(surface.observed_unconsumed_roles)) throw new Error(`${name}: role usage observations must be arrays`);
  }
  assertClosedKeys(grammar.cross_surface_policy, CROSS_POLICY_KEYS, "grammar.cross_surface_policy");
  const policy = grammar.cross_surface_policy;
  if (policy.value_equality_required !== false) throw new Error("cross-surface value equality must remain false");
  if (policy.shared_semantic_role_names_required !== false) throw new Error("cross-surface role-name equality must remain false");
  if (policy.raw_color_literals !== "census-only-not-authority") throw new Error("raw color literals must remain census-only");
  if (policy.role_usage_change_requires_review !== true) throw new Error("role usage changes must require review");
  if (policy.reduced_motion_required !== true) throw new Error("reduced-motion must remain required");
}

export function validateCssAgainstGrammar(grammar, cssBySurface) {
  validateGrammarShape(grammar);
  const report = { surfaces: {} };
  for (const name of SURFACE_NAMES) {
    const surface = grammar.surfaces[name];
    const css = cssBySurface[name];
    if (typeof css !== "string") throw new Error(`${name}: CSS source is missing`);
    const rootRoles = extractCustomProperties(extractBlock(css, ":root", name));
    assertStringMap(rootRoles, surface.root_roles, `${name} :root`);
    if (name === "shared_2d") {
      for (const [selector, expectedRoles] of Object.entries(surface.theme_overrides)) {
        const actualRoles = extractCustomProperties(extractBlock(css, selector, name));
        assertStringMap(actualRoles, expectedRoles, `${name} ${selector}`);
      }
    }
    const usage = assertRoleUsage(name, surface, css);
    report.surfaces[name] = {
      roles: Object.keys(surface.root_roles).length,
      consumed_roles: usage.consumed,
      unconsumed_roles: usage.unconsumed,
      raw_color_literals: rawColorLiteralCount(css)
    };
  }
  const threeCss = cssBySurface.threejs_cosmic;
  if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(threeCss)) throw new Error("threejs_cosmic: missing prefers-reduced-motion boundary");
  if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.three-label\s*\{[\s\S]*?will-change:\s*auto\s*;[\s\S]*?\}/.test(threeCss)) {
    throw new Error("threejs_cosmic: reduced-motion boundary must disable .three-label will-change");
  }
  const fingerprint = createHash("sha256").update(JSON.stringify(grammar)).digest("hex");
  return { ...report, fingerprint };
}

export async function validateDesignSystem(rootDir = process.cwd()) {
  const grammarPath = resolve(rootDir, "design", "ui-reference-grammar.json");
  const grammar = JSON.parse(await readFile(grammarPath, "utf8"));
  const cssBySurface = {};
  for (const name of SURFACE_NAMES) cssBySurface[name] = await readFile(resolve(rootDir, grammar.surfaces[name].file), "utf8");
  return validateCssAgainstGrammar(grammar, cssBySurface);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const report = await validateDesignSystem();
  const shared = report.surfaces.shared_2d;
  const three = report.surfaces.threejs_cosmic;
  console.log(`PROJECT_MAP_DESIGN_LINT_PASS shared_roles=${shared.roles} three_roles=${three.roles} three_consumed=${three.consumed_roles} three_unconsumed=${three.unconsumed_roles} shared_raw_colors=${shared.raw_color_literals} three_raw_colors=${three.raw_color_literals} fingerprint=${report.fingerprint}`);
}
