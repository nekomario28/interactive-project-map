import test from "node:test";
import assert from "node:assert/strict";
import { buildGraph } from "../src/graph.ts";
import { fetchStaticProfileGraph } from "../src/static-graph.ts";

const BYTE_LIMIT = 2_000_000;

function graphJson() {
  return JSON.stringify(buildGraph("octocat", [{
    id: 1,
    name: "example",
    html_url: "https://github.com/octocat/example",
    description: "日本語の説明",
    language: "TypeScript",
    topics: ["web"],
    stargazers_count: 1,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: "2026-11-13T00:00:00Z",
  }], true, true));
}

function paddedJson(byteCount) {
  const json = graphJson();
  const jsonBytes = Buffer.byteLength(json, "utf8");
  assert.ok(jsonBytes <= byteCount);
  return json + " ".repeat(byteCount - jsonBytes);
}

function streamedResponse(bytes, options = {}) {
  const { chunkSize = 64 * 1024, headers = {}, status = 200 } = options;
  let offset = 0;
  let cancelled = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      const next = Math.min(offset + chunkSize, bytes.byteLength);
      controller.enqueue(bytes.subarray(offset, next));
      offset = next;
    },
    cancel() { cancelled += 1; },
  });
  return {
    response: new Response(stream, { status, headers }),
    get bytesEnqueued() { return offset; },
    get cancelled() { return cancelled; },
  };
}

async function loadResponse(response) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response;
  try {
    return await fetchStaticProfileGraph("octocat");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("streamed graph accepts UTF-8 sequences split across chunks", async () => {
  const bytes = Buffer.from(graphJson());
  const multibyteStart = bytes.indexOf(Buffer.from("日"));
  assert.notEqual(multibyteStart, -1);
  const parts = [bytes.subarray(0, multibyteStart + 1), bytes.subarray(multibyteStart + 1)];
  const response = new Response(new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  }));
  const graph = await loadResponse(response);
  assert.ok(graph);
  assert.equal(graph.owner, "octocat");
  assert.equal(graph.repositoryCount, 1);
});

test("exact 2 MB byte limit remains accepted", async () => {
  const payload = paddedJson(BYTE_LIMIT);
  assert.equal(Buffer.byteLength(payload), BYTE_LIMIT);
  const source = streamedResponse(Buffer.from(payload));
  const graph = await loadResponse(source.response);
  assert.ok(graph);
  assert.equal(source.cancelled, 0);
});

test("one byte above 2 MB is rejected", async () => {
  const payload = paddedJson(BYTE_LIMIT + 1);
  assert.equal(Buffer.byteLength(payload), BYTE_LIMIT + 1);
  const source = streamedResponse(Buffer.from(payload));
  assert.equal(await loadResponse(source.response), null);
  // A stream may have already closed on its final chunk; early cancellation
  // is separately verified for longer oversized bodies below.
});

for (const declaredLength of [null, "32", "not-a-number"]) {
  test(`streaming stops oversized input even with Content-Length=${declaredLength ?? "(missing)"}`, async () => {
    const oversized = Buffer.alloc(BYTE_LIMIT * 2, 0x20);
    const source = streamedResponse(oversized, {
      headers: declaredLength === null ? {} : { "Content-Length": declaredLength },
    });
    const graph = await loadResponse(source.response);
    assert.equal(graph, null);
    assert.equal(source.cancelled, 1);
    assert.ok(source.bytesEnqueued < oversized.byteLength, "must stop before draining response");
  });
}

test("declared oversize is cancelled without reading the response", async () => {
  const source = streamedResponse(Buffer.from("{}"), {
    headers: { "Content-Length": String(BYTE_LIMIT + 1) },
  });
  assert.equal(await loadResponse(source.response), null);
  assert.equal(source.cancelled, 1);
});

test("invalid UTF-8 and truncated JSON fail closed", async () => {
  const invalidUtf8 = streamedResponse(Uint8Array.from([123, 34, 120, 34, 58, 34, 0xc3, 34, 125]));
  assert.equal(await loadResponse(invalidUtf8.response), null);
  const truncated = streamedResponse(Buffer.from('{"owner":"octocat"'));
  assert.equal(await loadResponse(truncated.response), null);
});

test("failed HTTP, absent body and interrupted streams fail closed", async () => {
  assert.equal(await loadResponse(new Response("{}", { status: 503 })), null);
  assert.equal(await loadResponse(new Response(null)), null);
  const interrupted = new Response(new ReadableStream({
    pull(controller) { controller.error(new Error("connection dropped")); },
  }));
  assert.equal(await loadResponse(interrupted), null);
});
