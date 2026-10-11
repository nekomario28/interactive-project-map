import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { censusRetryDelay, retryCensusRequest, updatePublicUsers } from "../scripts/update-public-users.mjs";

const sha = "a".repeat(40);
const checkedAt = "2026-10-04T10:00:00.000Z";
const initialReadme = "Intro\n<!-- public-users:start -->\nold count\n<!-- public-users:end -->\nSetup\n";

function file(content, path) {
  return { type: "file", encoding: "base64", size: Buffer.byteLength(content), content: Buffer.from(content).toString("base64"), path };
}

function fixtureApi({ logins = ["Alice", "alice"], profiles = {} } = {}) {
  return async (endpoint, accept) => {
    if (endpoint.startsWith("search/code?")) {
      return {
        total_count: logins.length, incomplete_results: false,
        items: logins.map((login) => ({ repository: { name: login, full_name: `${login}/${login}`, owner: { login, type: "User" }, private: false } })),
      };
    }
    const login = endpoint.split("/")[1];
    const profile = profiles[login] || {};
    if (!endpoint.includes("/commits/") && !endpoint.includes("/contents/")) {
      return { name: login, full_name: `${login}/${login}`, owner: { login, type: "User" }, private: false, fork: false, archived: false, default_branch: "main", ...profile.metadata };
    }
    if (endpoint.includes("/commits/missing")) return null;
    if (endpoint.includes("/commits/")) return { sha: endpoint.includes("/commits/pinned") ? "b".repeat(40) : sha };
    if (endpoint.includes("/contents/README.md?")) {
      if (profile.missingRootReadme) return null;
      assert.equal(accept, "application/vnd.github.html+json");
      return profile.html ?? `<a href="https://nekomario28.github.io/interactive-project-map/u/?username=${login}"><img src="project-map/galaxy.svg"></a>`;
    }
    if (endpoint.includes("graph.json")) {
      if (profile.missingGraph) return null;
      return file(profile.graph ?? JSON.stringify({ owner: login, generatedAt: checkedAt, nodes: [{ type: "owner", id: `user:${login}` }], edges: [] }), "project-map/graph.json");
    }
    if (endpoint.includes("galaxy.svg")) return file("<svg xmlns=\"http://www.w3.org/2000/svg\"><title>Project map</title></svg>", "project-map/galaxy.svg");
    throw new Error(`Unexpected fixture endpoint: ${endpoint}`);
  };
}

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), "project-map-users-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "data"));
  await writeFile(join(root, "README.md"), initialReadme);
  return root;
}

test("updates README from verified, case-insensitively deduplicated profile installs", async (t) => {
  const root = await workspace(t);
  const snapshot = await updatePublicUsers({ root, api: fixtureApi(), checkedAt });
  assert.deepEqual(snapshot.users.map((user) => user.login), ["Alice"]);
  assert.equal(snapshot.users[0].commit, sha);
  assert.equal(snapshot.users[0].graphUrl, `https://github.com/Alice/Alice/blob/${sha}/project-map/graph.json`);
  const readme = await readFile(join(root, "README.md"), "utf8");
  assert.match(readme, /Public users: 1 verified GitHub account/);
  assert.match(readme, /2026-10-04/);
  assert.ok(readme.startsWith("Intro\n"));
  assert.ok(readme.endsWith("\nSetup\n"));
  assert.deepEqual(JSON.parse(await readFile(join(root, "data/public-users.json"), "utf8")), snapshot);
});

test("does not count examples, missing outputs, copied graphs or archived profiles", async (t) => {
  const root = await workspace(t);
  const api = fixtureApi({
    logins: ["example", "missing", "copied", "malformed", "archived", "bob"],
    profiles: {
      example: { html: '<pre><code>&lt;a href="https://nekomario28.github.io/interactive-project-map/u/?username=example"&gt;&lt;img src="project-map/galaxy.svg"&gt;&lt;/a&gt;</code></pre>' },
      missing: { missingGraph: true },
      copied: { graph: JSON.stringify({ owner: "someone-else", generatedAt: checkedAt, nodes: [{ type: "owner", id: "user:someone-else" }], edges: [] }) },
      malformed: { graph: JSON.stringify({ owner: "malformed", generatedAt: checkedAt, nodes: [null], edges: [] }) },
      archived: { metadata: { archived: true } },
      bob: { html: '<p><a href="https://nekomario28.github.io/interactive-project-map/tree/?username=bob"><img src="https://raw.githubusercontent.com/bob/bob/HEAD/project-map/galaxy.svg" alt="Map"></a></p>' },
    },
  });
  const snapshot = await updatePublicUsers({ root, api, checkedAt });
  assert.deepEqual(snapshot.users.map((user) => user.login), ["bob"]);
  assert.deepEqual(snapshot.rejected.map((user) => user.login), ["example", "missing", "copied", "malformed", "archived"]);
});

test("keeps both published files unchanged when search or profile verification fails", async (t) => {
  const root = await workspace(t);
  await updatePublicUsers({ root, api: fixtureApi(), checkedAt });
  const paths = [join(root, "README.md"), join(root, "data/public-users.json")];
  const before = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  await assert.rejects(updatePublicUsers({ root, checkedAt, api: async () => ({ total_count: 1, incomplete_results: true, items: [] }) }), /incomplete/);
  const api = fixtureApi({ logins: ["Alice", "bob"] });
  await assert.rejects(updatePublicUsers({ root, checkedAt, api: async (endpoint, accept) => {
    if (endpoint.includes("repos/bob/bob/contents/project-map/graph")) throw new Error("GitHub HTTP 403");
    return api(endpoint, accept);
  } }), /HTTP 403/);
  assert.deepEqual(await Promise.all(paths.map((path) => readFile(path, "utf8"))), before);
});

test("rechecks known accounts after search omissions and admits explicitly supplied installs", async (t) => {
  const root = await workspace(t);
  await updatePublicUsers({ root, api: fixtureApi(), checkedAt });
  const snapshot = await updatePublicUsers({ root, api: fixtureApi({ logins: [] }), include: ["bob"], checkedAt });
  assert.deepEqual(snapshot.users.map((user) => user.login), ["Alice", "bob"]);
  const removed = await updatePublicUsers({ root, api: fixtureApi({ logins: [], profiles: { Alice: { missingGraph: true } } }), checkedAt });
  assert.deepEqual(removed.users.map((user) => user.login), ["bob"]);
});

test("offline validation rejects a stale count without network calls or writes", async (t) => {
  const root = await workspace(t);
  await updatePublicUsers({ root, api: fixtureApi(), checkedAt });
  const api = async () => { throw new Error("Offline validation must not query GitHub"); };
  const snapshot = await updatePublicUsers({ root, api, check: true });
  assert.deepEqual(snapshot.users.map((user) => user.login), ["Alice"]);
  const path = join(root, "README.md");
  const stale = (await readFile(path, "utf8")).replace("Public users: 1", "Public users: 999");
  await writeFile(path, stale);
  await assert.rejects(updatePublicUsers({ root, api, check: true }), /out of sync/);
  assert.equal(await readFile(path, "utf8"), stale);
});

test("requires a root profile README and rendered image and link attributes", async (t) => {
  const root = await workspace(t);
  const viewer = (login) => `https://nekomario28.github.io/interactive-project-map/u/?username=${login}`;
  const api = fixtureApi({
    logins: ["nested", "inline", "lazy", "attribute", "reference"],
    profiles: {
      nested: { missingRootReadme: true },
      inline: { html: '<p><code>&lt;img src="project-map/galaxy.svg"&gt;</code></p>' },
      lazy: { html: `<a href="${viewer("lazy")}"><img data-src="project-map/galaxy.svg"></a>` },
      attribute: { html: `<a href="${viewer("attribute")}"><img alt=" src='project-map/galaxy.svg'"></a>` },
      reference: { html: `<p><a href="${viewer("reference")}"><img src="project-map/galaxy.svg" alt="Map"></a></p>` },
    },
  });
  const snapshot = await updatePublicUsers({ root, api, checkedAt });
  assert.deepEqual(snapshot.users.map((user) => user.login), ["reference"]);
  assert.deepEqual(snapshot.rejected.map((user) => user.login), ["nested", "inline", "lazy", "attribute"]);
});

test("rejects broken SVG references and pins evidence to the image's actual commit", async (t) => {
  const root = await workspace(t);
  const embed = (login, source) => `<a href="https://nekomario28.github.io/interactive-project-map/u/?username=${login}"><img src="${source}"></a>`;
  const api = fixtureApi({
    logins: ["missingref", "noref", "wrongcase", "pinned"],
    profiles: {
      missingref: { html: embed("missingref", "https://raw.githubusercontent.com/missingref/missingref/missing/project-map/galaxy.svg") },
      noref: { html: embed("noref", "https://raw.githubusercontent.com/noref/noref/project-map/galaxy.svg") },
      wrongcase: { html: embed("wrongcase", "PROJECT-MAP/GALAXY.SVG") },
      pinned: { html: embed("pinned", "https://raw.githubusercontent.com/pinned/pinned/pinned/project-map/galaxy.svg") },
    },
  });
  const snapshot = await updatePublicUsers({ root, api, checkedAt });
  assert.deepEqual(snapshot.users.map((user) => user.login), ["pinned"]);
  assert.equal(snapshot.users[0].commit, sha);
  assert.equal(snapshot.users[0].embeddedSvgUrl, `https://github.com/pinned/pinned/blob/${"b".repeat(40)}/project-map/galaxy.svg`);
  assert.deepEqual(snapshot.rejected.map((user) => user.login), ["missingref", "noref", "wrongcase"]);
});

function ghFailure(status) {
  return Object.assign(new Error("Command failed: gh api"), {
    stderr: `gh: GitHub API error (HTTP ${status})\n{"message":"Error","status":"${status}"}\n`,
  });
}

test("retries a rate-limited census request and keeps the eventual result", async () => {
  const delays = [];
  let calls = 0;
  const result = await retryCensusRequest(async () => {
    calls += 1;
    if (calls <= 2) throw ghFailure(429);
    return { total_count: 0, incomplete_results: false, items: [] };
  }, { sleep: async (ms) => { delays.push(ms); } });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
  assert.equal(result.incomplete_results, false);
});

test("does not retry an authorization failure and preserves the fail-closed error", async () => {
  let calls = 0;
  const failure = ghFailure(403);
  await assert.rejects(
    retryCensusRequest(async () => { calls += 1; throw failure; }, { sleep: async () => {} }),
    (error) => error === failure,
  );
  assert.equal(calls, 1);
});

test("gives up after the attempt budget instead of retrying a permanent limit", async () => {
  const delays = [];
  let calls = 0;
  const failure = ghFailure(429);
  await assert.rejects(
    retryCensusRequest(async () => { calls += 1; throw failure; }, { sleep: async (ms) => { delays.push(ms); } }),
    (error) => error === failure,
  );
  assert.equal(calls, 7);
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 32000]);
  assert.ok(delays.reduce((total, ms) => total + ms, 0) >= 60_000, "budget must outlast the measured code_search window");
});

test("caps the census backoff so a daily run cannot stall the job", () => {
  assert.equal(censusRetryDelay(0), 1000);
  assert.equal(censusRetryDelay(30), 120_000);
});
