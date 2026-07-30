import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'src');
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const safePath = normalize(relative || 'index.html').replace(/^(\.\.[/\\])+/, '');
  let filePath = join(root, safePath);
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');
  if (!existsSync(filePath)) filePath = join(root, 'index.html');
  response.setHeader('Content-Type', mimeTypes[extname(filePath)] || 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  createReadStream(filePath).pipe(response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`87L laboratory: http://localhost:${port}`);
});
