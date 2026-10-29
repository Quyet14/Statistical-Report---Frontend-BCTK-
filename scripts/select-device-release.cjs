const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, 'deploy/.runtime');
const manifest = JSON.parse(fs.readFileSync(path.join(runtime, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
const files = { frontend: path.join(runtime, 'frontend.env'), backend: path.join(runtime, 'backend.env') };
const backup = path.join(runtime, 'device-release-previous.json');
const buildId = path.join(root, '.next-device-release/BUILD_ID');
const backendBuild = path.join(manifest.backendDir, 'dist-device-release/main.js');
const ready = fs.existsSync(buildId) && fs.existsSync(backendBuild);
if (process.argv.includes('--activate')) {
  if (!ready) throw new Error('Both isolated release builds are required');
  const raw = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, fs.readFileSync(file, 'utf8')]));
  if (!Object.values(raw).every(text => dotenv.parse(text).CAREOPS_RELEASE === 'device')) {
    if (fs.existsSync(backup)) throw new Error('Previous release backup already exists; inspect before changing again');
    fs.writeFileSync(backup, JSON.stringify(raw), { flag: 'wx' });
    for (const [name, file] of Object.entries(files)) {
      const line = 'CAREOPS_RELEASE=device';
      const text = /^CAREOPS_RELEASE=.*$/m.test(raw[name]) ? raw[name].replace(/^CAREOPS_RELEASE=.*$/m, () => line) : raw[name].replace(/\s*$/, '') + '\n' + line + '\n';
      fs.writeFileSync(file, text);
    }
  }
  console.log(JSON.stringify({ selected: 'device', restartRequired: true, origin: manifest.origin }));
} else if (process.argv.includes('--restore')) {
  const raw = JSON.parse(fs.readFileSync(backup, 'utf8'));
  for (const [name, file] of Object.entries(files)) {
    if (typeof raw[name] !== 'string') throw new Error('Invalid saved configuration');
    // Roll back the code release while retaining the LAN address currently assigned to this machine.
    const setting = name === 'frontend' ? 'FRONTEND_ORIGIN' : 'CORS_ORIGINS';
    const pattern = new RegExp('^' + setting + '=.*$', 'm');
    const text = pattern.test(raw[name]) ? raw[name].replace(pattern, () => setting + '=' + manifest.origin) : raw[name] + '\n' + setting + '=' + manifest.origin + '\n';
    fs.writeFileSync(file, text);
  }
  console.log(JSON.stringify({ restored: true, restartRequired: true }));
} else {
  console.log(JSON.stringify({ ready, frontendBuildId: ready ? fs.readFileSync(buildId, 'utf8').trim() : null, backendBuildExists: fs.existsSync(backendBuild), origin: manifest.origin, selected: dotenv.parse(fs.readFileSync(files.frontend)).CAREOPS_RELEASE || 'default' }));
  if (!ready) process.exitCode = 1;
}
