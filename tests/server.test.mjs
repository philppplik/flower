import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
let server;
const base = 'http://127.0.0.1:5197';
before(async () => {
  server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '5197' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000); server.stdout.once('data', () => { clearTimeout(timer); resolve(); }); server.once('error', reject); });
});
after(() => server?.kill());
test('serves Flower landing page with privacy and content security headers', async () => { const response = await fetch(base); assert.equal(response.status, 200); assert.match(await response.text(), /Flower/); assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/); });
test('studio is a separate route with guided onboarding', async () => { const response = await fetch(base + '/studio.html'); assert.equal(response.status, 200); assert.match(await response.text(), /welcome-dialog/); });
test('only public assets are exposed', async () => { for (const path of ['/package.json', '/server.mjs', '/python/segment.py', '/.venv/pyvenv.cfg', '/src/../../server.mjs', '/src/%5c..%5cserver.mjs']) { const r = await fetch(base + path); assert.ok(r.status >= 400, path); } });
test('rejects cross-origin mutation attempts', async () => { const r = await fetch(base + '/api/segment', { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'image/png' }, body: 'x' }); assert.equal(r.status, 403); });
test('rejects invalid local host to prevent DNS rebinding', async () => { const status = await new Promise((resolve, reject) => { http.get(base, { headers: { Host: 'untrusted.example:5197' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject); }); assert.equal(status, 403); });
test('segmentation validates media type and PNG signature before spawning AI', async () => { let r = await fetch(base + '/api/segment', { method: 'POST', body: 'x' }); assert.equal(r.status, 415); r = await fetch(base + '/api/segment', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: 'bad png' }); assert.equal(r.status, 400); });
test('unsupported methods do not expose filesystem writes', async () => { const r = await fetch(base + '/src/app.js', { method: 'PUT', body: 'bad' }); assert.equal(r.status, 405); });
