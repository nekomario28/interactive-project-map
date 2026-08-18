import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "site");
const port = Number(process.env.PORT || 4173);
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".png", "image/png"],
]);

function resolvePath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const relative = normalize(pathname).replace(/^([/\\])+/, "");
  let file = join(root, relative);
  try {
    if (statSync(file).isDirectory()) file = join(file, "index.html");
  } catch {
    if (!extname(file)) file = join(file, "index.html");
  }
  if (!file.startsWith(root)) return null;
  return file;
}

const server = createServer((request, response) => {
  if (!request.url || !["GET", "HEAD"].includes(request.method || "GET")) {
    response.writeHead(405).end();
    return;
  }
  const file = resolvePath(request.url);
  if (!file) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error("not a file");
    response.writeHead(200, {
      "content-type": types.get(extname(file)) || "application/octet-stream",
      "cache-control": "no-store",
      "content-length": stat.size,
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving site at http://127.0.0.1:${port}`);
});
