import { createServer } from "node:http";
import { extname, normalize } from "node:path";
import { readFile } from "node:fs/promises";

const root = new URL("../dist/client/", import.meta.url);
const port = Number(process.env.PORT || 4178);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://preview.local").pathname);
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  let fileUrl = new URL(safePath || "index.html", root);
  try {
    const data = await readFile(fileUrl);
    response.writeHead(200, { "content-type": mime[extname(fileUrl.pathname)] || "application/octet-stream" });
    response.end(data);
  } catch {
    fileUrl = new URL("index.html", root);
    const data = await readFile(fileUrl);
    response.writeHead(200, { "content-type": mime[extname(fileUrl.pathname)] });
    response.end(data);
  }
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Test preview ready on ${port}\n`);
});
