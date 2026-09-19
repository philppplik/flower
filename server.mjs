import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);
const localPython = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.ASCII_PYTHON || (existsSync(localPython) ? localPython : 'python');
const modelRoot = process.env.U2NET_HOME || path.join(root, '.cache', 'models');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const maxBody = 12 * 1024 * 1024;
let segmentationBusy = false;
function pythonJob(args, input, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, { cwd: root, windowsHide: true, env: { ...process.env, U2NET_HOME: modelRoot } });
    const chunks = []; let length = 0, stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Local AI timed out. Check model download access and try again.')); }, timeout);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stdout.on('data', chunk => { length += chunk.length; if (length > maxBody) { child.kill(); reject(new Error('AI output exceeded the size limit.')); } else chunks.push(chunk); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-3000); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(stderr.trim().split('\n').at(-1) || 'Local AI process failed.')); });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
function json(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); }
async function body(request) {
  if (Number(request.headers['content-length']) > maxBody) throw new Error('Image exceeds 12 MB.');
  const chunks = []; let length = 0;
  for await (const chunk of request) { length += chunk.length; if (length > maxBody) throw new Error('Image exceeds 12 MB.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
  if (!allowedHosts.includes(request.headers.host)) return json(response, 403, { error: 'Invalid local host.' });
  if (request.headers.origin && !allowedHosts.some(host => request.headers.origin === `http://${host}`)) return json(response, 403, { error: 'Cross-origin requests are not allowed.' });
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/status' && request.method === 'GET') {
      const aiReady = await pythonJob(['-c', "import importlib.util; print('yes' if importlib.util.find_spec('rembg') and importlib.util.find_spec('onnxruntime') else 'no')"], undefined, 10000).then(result => result.toString().trim() === 'yes').catch(() => false);
      const modelCached = [path.join(modelRoot, 'u2net.onnx'), path.join(modelRoot, 'models', 'u2net', 'u2net.onnx')].some(existsSync);
      return json(response, 200, { aiReady, modelCached });
    }
    if (url.pathname === '/api/segment' && request.method === 'POST') {
      if (request.headers['content-type'] !== 'image/png') return json(response, 415, { error: 'Send a PNG image.' });
      if (segmentationBusy) return json(response, 429, { error: 'A local selection is already running.' });
      segmentationBusy = true;
      try {
        const input = await body(request);
        if (!input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return json(response, 400, { error: 'Invalid PNG image.' });
        const result = await pythonJob([path.join(root, 'python', 'segment.py')], input);
        response.writeHead(200, { 'Content-Type': 'image/png' }); response.end(result);
      } catch (error) { json(response, 422, { error: error.message }); }
      finally { segmentationBusy = false; }
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { error: 'Method not allowed.' });
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').includes('..')) return json(response, 400, { error: 'Invalid path.' });
    // Only public application assets are served. No project/config/source-server exposure.
    if (!(pathname === '/' || pathname === '/index.html' || pathname === '/studio.html' || /^\/(src|assets)\/[a-zA-Z0-9_./-]+$/.test(pathname))) return json(response, 404, { error: 'Not found.' });
    const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root + path.sep)) return json(response, 403, { error: 'Invalid path.' });
    const content = await readFile(filename);
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) { json(response, error.code === 'ENOENT' ? 404 : 400, { error: error.code === 'ENOENT' ? 'Not found.' : 'Invalid request.' }); }
});
server.requestTimeout = 310000;
server.listen(port, '127.0.0.1', () => console.log(`Flower is ready at http://127.0.0.1:${port}/studio.html`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
