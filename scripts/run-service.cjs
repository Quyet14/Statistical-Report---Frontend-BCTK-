const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const service = process.argv[2];
if (!['frontend', 'backend', 'backup'].includes(service)) throw new Error('Usage: node scripts/run-service.cjs frontend|backend|backup [config-directory]');
const directory = path.resolve(process.argv[3] || path.join(root, 'deploy/.runtime'));
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));
const env = dotenv.parse(fs.readFileSync(path.join(directory, `${service}.env`)));
if (service === 'backup' && env.BACKUP_AUTOMATION_ENABLED !== 'true') throw new Error('Backup worker is disabled');
const cwd = service === 'frontend' ? root : manifest.backendDir;
const backendBuild = env.CAREOPS_RELEASE === 'organization' ? 'dist-organization-release/main.js' : env.CAREOPS_RELEASE === 'work' ? 'dist-work-release/main.js' : env.CAREOPS_RELEASE === 'device' ? 'dist-device-release/main.js' : 'dist/main.js';
const workBackendDir = env.CAREOPS_WORK_BACKEND_DIR;
if (
  workBackendDir &&
  !/^dist-work-release(?:-[A-Za-z0-9._-]+)?$/.test(workBackendDir)
)
  throw new Error('Invalid CAREOPS_WORK_BACKEND_DIR');
const selectedBackendBuild =
  service === 'backend' &&
  env.CAREOPS_RELEASE === 'work' &&
  workBackendDir
    ? path.join(workBackendDir, 'main.js')
    : backendBuild;
const command = service === 'frontend' ? [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', env.PORT || '3000'] : service === 'backup' ? [path.join(cwd, 'scripts/backup-worker.cjs')] : [path.join(cwd, selectedBackendBuild)];
const child = spawn(process.execPath, command, { cwd, env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', () => { console.error('Không khởi động được dịch vụ'); process.exitCode = 1; });
