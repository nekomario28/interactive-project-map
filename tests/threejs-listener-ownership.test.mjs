import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const baseSource = readFileSync(new URL("../scripts/public-threejs-viewer.js", import.meta.url), "utf8");
const builtSource = readFileSync(new URL("../site/threejs-viewer.js", import.meta.url), "utf8");

function makeEventTarget(name, registry) {
  const active = new Map();
  const captured = new Set();
  const classes = new Set();
  const children = [];
  const target = {
    _name: name,
    dataset: {},
    style: {},
    hidden: false,
    disabled: false,
    value: "",
    textContent: "",
    href: "",
    width: 800,
    height: 600,
    children,
    classList: {
      add(...names) { for (const n of names) classes.add(n); },
      remove(...names) { for (const n of names) classes.delete(n); },
      contains(n) { return classes.has(n); },
    },
    setAttribute() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    append(...items) { children.push(...items); },
    replaceChildren(...items) { children.splice(0, children.length, ...items); },
    remove() {},
    focus() {},
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() {},
      fillStyle: "",
    }),
    setPointerCapture(id) { captured.add(id); },
    hasPointerCapture(id) { return captured.has(id); },
    releasePointerCapture(id) { captured.delete(id); },
    addEventListener(type, fn, opts) {
      if (!active.has(type)) active.set(type, new Set());
      active.get(type).add({ fn, opts });
      registry.added += 1;
    },
    removeEventListener(type, fn, opts) {
      const entries = active.get(type);
      if (entries) {
        for (const entry of entries) {
          if (entry.fn === fn && entry.opts === opts) entries.delete(entry);
        }
        if (entries.size === 0) active.delete(type);
      }
      registry.removed += 1;
    },
    dispatchEvent(event) {
      const entries = active.get(event.type);
      if (!entries) return true;
      for (const { fn } of [...entries]) fn(event);
      return true;
    },
    _listenerCount() {
      let total = 0;
      for (const entries of active.values()) total += entries.size;
      return total;
    },
    _capturedPointers: captured,
  };
  return target;
}

function makeThreeMock() {
  class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    lerp(v, a) { this.x += (v.x - this.x) * a; this.y += (v.y - this.y) * a; this.z += (v.z - this.z) * a; return this; }
    project() { return this; }
  }
  class Vec2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }
  class Color {
    constructor(v = 0) { this.v = v; this.r = 1; this.g = 1; this.b = 1; }
    setHSL() { return this; }
    clone() { return new Color(this.v); }
    multiplyScalar() { return this; }
    lerp() { return this; }
    copy() { return this; }
  }
  class Object3D {
    constructor() {
      this.position = new Vec3();
      this.rotation = new Vec3();
      this.scale = { set: () => {}, setScalar: () => {} };
      this.children = [];
      this.userData = {};
      this.visible = true;
    }
    add(...items) { this.children.push(...items); }
    remove(item) { this.children = this.children.filter((c) => c !== item); }
    traverse(fn) { fn(this); for (const c of this.children) c.traverse?.(fn); }
  }
  class Geometry { setAttribute() {} dispose() {} }
  class Material { constructor(o = {}) { Object.assign(this, o); } dispose() {} }
  return {
    SRGBColorSpace: "srgb",
    ACESFilmicToneMapping: 4,
    AdditiveBlending: 2,
    Color,
    Vector3: Vec3,
    Vector2: Vec2,
    FogExp2: class {},
    WebGLRenderer: class {
      constructor() { this.renderLists = { dispose() {} }; }
      setPixelRatio() {}
      setSize() {}
      render() {}
    },
    PerspectiveCamera: class { constructor() { this.position = new Vec3(); } updateProjectionMatrix() {} lookAt() {} },
    Scene: class extends Object3D {},
    Group: class extends Object3D {},
    HemisphereLight: class extends Object3D {},
    PointLight: class extends Object3D {},
    CanvasTexture: class { dispose() {} },
    BufferGeometry: Geometry,
    BufferAttribute: class {},
    Float32BufferAttribute: class {},
    PointsMaterial: Material,
    Points: class extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } },
    SpriteMaterial: Material,
    Sprite: class extends Object3D { constructor(m) { super(); this.material = m; } },
    IcosahedronGeometry: Geometry,
    SphereGeometry: Geometry,
    TorusGeometry: Geometry,
    MeshStandardMaterial: Material,
    MeshBasicMaterial: Material,
    Mesh: class extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } },
    LineBasicMaterial: Material,
    LineSegments: class extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } },
    Raycaster: class { setFromCamera() {} intersectObjects() { return []; } },
  };
}

function makeSandbox({ failOnResizeObserver = false } = {}) {
  const registry = { added: 0, removed: 0 };
  const byId = new Map();
  const ids = [
    "galaxy3d", "threeLabels", "title", "subtitle", "search", "fit", "reset",
    "motionToggle", "resultCount", "details", "detailsClose", "detailsTitle",
    "detailsDescription", "detailsMeta", "detailsLink", "tip", "status",
    "error", "errorText", "fallbackLink", "twoDLink", "focusButton",
    "focusControls", "focusLabel", "exitFocus",
  ];
  for (const id of ids) byId.set(id, makeEventTarget(id, registry));
  const statusButtons = ["original", "fork", "archived", "contributed"].map((status) => {
    const el = makeEventTarget(`status:${status}`, registry);
    el.dataset.statusFilter = status;
    return el;
  });
  const focusDepthButtons = ["1", "2", "3"].map((depth) => {
    const el = makeEventTarget(`depth:${depth}`, registry);
    el.dataset.focusDepth = depth;
    return el;
  });
  const unrelatedTarget = makeEventTarget("unrelated", registry);
  const windowObj = makeEventTarget("window", registry);
  const observerState = { constructed: 0, disconnected: 0 };
  const rafState = { nextId: 1, active: new Set() };
  const origProtoDescriptor = Object.getOwnPropertyDescriptor(EventTarget.prototype, "addEventListener");

  const documentObj = {
    body: { dataset: {} },
    getElementById: (id) => byId.get(id) ?? null,
    querySelectorAll: (sel) => sel === "[data-status-filter]" ? statusButtons : sel === "[data-focus-depth]" ? focusDepthButtons : [],
    createElement: (tag) => makeEventTarget(`created:${tag}`, registry),
  };

  Object.assign(windowObj, {
    location: { href: "https://example.test/three/?username=octocat&style3d=cosmic" },
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    CustomEvent: class { constructor(type) { this.type = type; } },
    EventTarget,
    ProjectMapViewModel: null,
    ProjectMapTransferableState: null,
    ProjectMapThreejsGalaxyMotion: undefined,
  });

  const instrumented = `${builtSource.replace(/\bboot\(\);\s*$/, "")}\n;globalThis.__testExports = { createSceneRuntime, ui };`;
  const context = {
    window: windowObj,
    document: documentObj,
    location: windowObj.location,
    history: { replaceState() {} },
    URL,
    URLSearchParams,
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    performance: { now: () => 0 },
    open: () => null,
    EventTarget,
    requestAnimationFrame: () => {
      const id = rafState.nextId++;
      rafState.active.add(id);
      return id;
    },
    cancelAnimationFrame: (id) => {
      rafState.active.delete(id);
    },
    ResizeObserver: class {
      constructor() {
        observerState.constructed += 1;
        if (failOnResizeObserver) throw new Error("injected ResizeObserver init failure");
      }
      observe() {}
      disconnect() { observerState.disconnected += 1; }
    },
    setTimeout,
    clearTimeout,
  };

  runInNewContext(instrumented, context);
  const protoStillOriginal = Object.getOwnPropertyDescriptor(EventTarget.prototype, "addEventListener")?.value === origProtoDescriptor?.value;
  return {
    ...context.__testExports,
    registry,
    byId,
    statusButtons,
    focusDepthButtons,
    unrelatedTarget,
    windowObj,
    observerState,
    rafState,
    protoStillOriginal,
    allTargets: [windowObj, ...byId.values(), ...statusButtons, ...focusDepthButtons],
  };
}

const sampleGraph = {
  owner: "octocat",
  nodes: [
    { id: "user:octocat", label: "octocat", type: "owner" },
    { id: "group:web", label: "Web", type: "group", repositoryCount: 1 },
    { id: "repository:demo", label: "demo", type: "repository", groupId: "web", groupLabel: "Web", stars: 5, forks: 1, url: "https://github.com/octocat/demo" },
  ],
  edges: [
    { source: "user:octocat", target: "group:web", type: "ownership" },
    { source: "group:web", target: "repository:demo", type: "membership" },
  ],
};

test("generated and source Three.js runtimes never mutate EventTarget.prototype", () => {
  assert.doesNotMatch(baseSource, /EventTarget\.prototype/);
  assert.doesNotMatch(builtSource, /EventTarget\.prototype/);
  assert.match(baseSource, /function listen\(target,type,fn,opts\)/);
  assert.match(builtSource, /function listen\(target,type,fn,opts\)/);
});

test("repeated mount/unmount cycles remove all runtime listeners, captures, frames, observers and labels", () => {
  const sandbox = makeSandbox();
  assert.equal(sandbox.protoStillOriginal, true);

  const unrelatedHandler = () => {};
  sandbox.unrelatedTarget.addEventListener("custom", unrelatedHandler);

  const THREE = makeThreeMock();
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const beforeAdded = sandbox.registry.added;
    const runtime = sandbox.createSceneRuntime(THREE, sampleGraph, "octocat");
    assert.ok(sandbox.registry.added > beforeAdded, "cycle should register runtime listeners");
    assert.ok(sandbox.byId.get("threeLabels").children.length > 0, "DOM labels should be mounted");

    // Simulate an active pointer capture during disposal.
    sandbox.ui.canvas.dispatchEvent({ type: "pointerdown", pointerType: "mouse", button: 0, pointerId: 42, clientX: 10, clientY: 10 });
    assert.equal(sandbox.ui.canvas.hasPointerCapture(42), true);

    runtime.dispose();
    runtime.dispose(); // idempotent

    assert.equal(sandbox.registry.removed, sandbox.registry.added - 1, "all runtime listeners except unrelated must be removed");
    for (const target of sandbox.allTargets) {
      assert.equal(target._listenerCount(), 0, `expected 0 remaining listeners on ${target._name}`);
    }
    assert.equal(sandbox.ui.canvas.hasPointerCapture(42), false, "pointer capture must be released on dispose");
    assert.equal(sandbox.ui.canvas.classList.contains("dragging"), false);
    assert.equal(sandbox.byId.get("threeLabels").children.length, 0, "DOM labels must be cleared");
    assert.equal(sandbox.rafState.active.size, 0, "animation frames must be cancelled");
    assert.equal(sandbox.observerState.disconnected, sandbox.observerState.constructed);
    assert.equal(sandbox.unrelatedTarget._listenerCount(), 1, "unrelated listeners must not be captured or removed");
  }

  assert.equal(sandbox.protoStillOriginal, true);
});

test("partial initialization failure rolls back already-registered listeners cleanly", () => {
  const sandbox = makeSandbox({ failOnResizeObserver: true });
  const THREE = makeThreeMock();

  assert.throws(
    () => sandbox.createSceneRuntime(THREE, sampleGraph, "octocat"),
    /injected ResizeObserver init failure/,
  );

  assert.ok(sandbox.registry.added > 0, "listeners were registered before failure");
  assert.equal(sandbox.registry.removed, sandbox.registry.added, "all partially registered listeners must be cleaned up");
  for (const target of sandbox.allTargets) {
    assert.equal(target._listenerCount(), 0, `leaked listener on ${target._name}`);
  }
  assert.equal(sandbox.byId.get("threeLabels").children.length, 0, "DOM labels must be rolled back");
  assert.equal(sandbox.protoStillOriginal, true);
});
