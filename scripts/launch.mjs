import { spawn } from 'node:child_process';
const url = `http://127.0.0.1:${Number(process.env.PORT || 5173)}`;
function openBrowser() {
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', `${url}/studio.html`] : [`${url}/studio.html`];
  const opener = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true });
  opener.on('error', () => console.log(`Open ${url} in your browser.`)); opener.unref();
}
// Reuse an existing studio rather than starting a second process on the same port.
const running = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(1000) }).then(response => response.ok).catch(() => false);
if (running) openBrowser();
else {
  const server = spawn(process.execPath, ['server.mjs'], { stdio: ['inherit', 'pipe', 'inherit'] });
  let opened = false;
  server.stdout.on('data', data => { process.stdout.write(data); if (!opened) { opened = true; openBrowser(); } });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.on('exit', code => { process.exitCode = code || 0; });
  process.on('SIGINT', () => server.kill()); process.on('SIGTERM', () => server.kill());
}
