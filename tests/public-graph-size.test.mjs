import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const FILES = ["scripts/public-viewer.js", "scripts/public-radial-viewer.js"];

function extractReadBoundedGraph(source) {
  const start = source.indexOf("async function readBoundedGraph(response) {");
  assert.notEqual(start, -1);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const body = source.slice(start, index + 1);
        return { body, readBoundedGraph: new Function(`${body}\nreturn readBoundedGraph;`)() };
      }
    }
  }
  throw new Error("readBoundedGraph was not closed");
}

function readerFrom(chunks) {
  let index = 0;
  const reader = {
    cancelled: false,
    async read() {
      if (index >= chunks.length) return { done: true, value: undefined };
      const value = chunks[index];
      index += 1;
      return { done: false, value };
    },
    async cancel() {
      reader.cancelled = true;
    },
  };
  return reader;
}

test("graph.json loads reject an oversized payload before parse", async () => {
  const sources = await Promise.all(FILES.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  const extracted = sources.map(extractReadBoundedGraph);
  assert.equal(extracted[0].body, extracted[1].body);
  const readers = extracted.map((item) => item.readBoundedGraph);

  const encoded = new TextEncoder();
  const small = encoded.encode('{"ok":true}');
  const split = Math.floor(small.byteLength / 2);
  for (const readBoundedGraph of readers) {
    let reads = 0;
    await assert.rejects(
      readBoundedGraph({
        headers: { get: (name) => (name === "content-length" ? "8000001" : null) },
        body: { getReader() { reads += 1; throw new Error("body should not be read"); } },
      }),
      /larger than the 8 MB limit \(8000001 bytes\)/,
    );
    assert.equal(reads, 0);

    const oversized = new Uint8Array(8_000_001);
    const stream = readerFrom([oversized]);
    await assert.rejects(
      readBoundedGraph({
        headers: { get: () => null },
        body: { getReader: () => stream },
      }),
      /larger than the 8 MB limit/,
    );
    assert.equal(stream.cancelled, true);

    const value = await readBoundedGraph({
      headers: { get: (name) => (name === "content-length" ? String(small.byteLength) : null) },
      body: { getReader: () => readerFrom([small.subarray(0, split), small.subarray(split)]) },
    });
    assert.deepEqual(value, { ok: true });
  }
});
