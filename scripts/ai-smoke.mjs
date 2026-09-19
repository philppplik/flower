import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const python = process.env.ASCII_PYTHON || path.resolve('.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const fixture = spawnSync(python, ['-c', "from PIL import Image,ImageDraw; import sys; im=Image.new('RGB',(160,100),'#197eb6'); ImageDraw.Draw(im).rectangle((40,20,120,80),fill='#ff982d'); im.save(sys.stdout.buffer,format='PNG')"]);
assert.equal(fixture.status, 0, fixture.stderr.toString());
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '5199', ASCII_PYTHON: python }, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000); server.stdout.once('data', () => { clearTimeout(timer); resolve(); }); server.once('error', reject); });
  const status = await (await fetch('http://127.0.0.1:5199/api/status')).json(); assert.equal(status.aiReady, true); assert.equal(status.modelCached, true);
  const response = await fetch('http://127.0.0.1:5199/api/segment', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: fixture.stdout, signal: AbortSignal.timeout(300000) });
  if (!response.ok) throw new Error(await response.text());
  const result = Buffer.from(await response.arrayBuffer());
  const validation = spawnSync(python, ['-c', "from PIL import Image; import sys,io; im=Image.open(io.BytesIO(sys.stdin.buffer.read())); assert im.size==(160,100); low,high=im.getextrema(); assert low < high; assert high > 128; print('AI returned a non-uniform grayscale foreground mask at the correct size.')"], { input: result });
  assert.equal(validation.status, 0, validation.stderr.toString());
  await mkdir('test-results', { recursive: true }); await writeFile('test-results/ai-mask.png', result);
  console.log(validation.stdout.toString().trim());
} finally { server.kill(); }
