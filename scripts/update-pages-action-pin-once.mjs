import { readFile, writeFile } from "node:fs/promises";

const oldRef = "977531824bc7a65c703c692ea4de98b4fed7ca5f";
const newRef = "caeca4b7b33603109bbadd860a68fdae476c7482";
const files = [
  "scripts/postprocess-public-pages.mjs",
  "tests/interaction-polish.test.mjs",
];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const count = source.split(oldRef).length - 1;
  if (count !== 1) throw new Error(`${file}: expected exactly one ${oldRef}, found ${count}`);
  const next = source.replace(oldRef, newRef);
  if (!next.includes(newRef) || next.includes(oldRef)) throw new Error(`${file}: pin replacement failed`);
  await writeFile(file, next);
  console.log(`updated ${file}`);
}
