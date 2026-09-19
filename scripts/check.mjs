import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function files(folder) { const entries = await readdir(folder, { withFileTypes: true }); const result = []; for (const entry of entries) { const name = `${folder}/${entry.name}`; if (entry.isDirectory()) result.push(...await files(name)); else if (/\.(mjs|js)$/.test(name)) result.push(name); } return result; }
let failed = false;
for (const file of ['server.mjs', ...await files('src'), ...await files('tests'), ...await files('scripts')]) { const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' }); failed ||= result.status !== 0; }
if (failed) process.exit(1);
console.log('All JavaScript modules passed syntax checks.');
