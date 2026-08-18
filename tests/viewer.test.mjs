import test from "node:test";
import assert from "node:assert/strict";
import { renderViewer } from "../src/viewer.ts";

test("interactive viewer asks the graph API to prefer the user's static profile graph", () => {
  const html = renderViewer("octocat");
  assert.match(html, /graphUrl\.searchParams\.set\('username',username\)/);
  assert.match(html, /graphUrl\.searchParams\.set\('static','1'\)/);
  assert.match(html, /\['max_repos','forks','archived'\]/);
  assert.doesNotMatch(html, /raw\.githubusercontent\.com/);
});
