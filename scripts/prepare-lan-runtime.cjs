const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { isIP } = require('node:net');
const { X509Certificate } = require('node:crypto');
const { spawnSync } = require('node:child_process');
function setting(text, name, value) {
  const pattern = new RegExp('^' + name + '=.*$', 'm');
  return pattern.test(text) ? text.replace(pattern, () => name + '=' + value) : text.replace(/\s*$/, '') + '\n' + name + '=' + value + '\n';
}
function runtimeSettings(frontend, backend, host, frontendPort = 3300, backendPort = 3310) {
  if (isIP(host) !== 4 || !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) throw new Error('Use an assigned private LAN IPv4 address');
  if (![frontendPort, backendPort].every(port => Number.isInteger(port) && port >= 1024 && port <= 65535) || frontendPort === backendPort || [frontendPort, backendPort].includes(3443)) throw new Error('Use separate valid internal ports');
  const origin = `https://${host}:3443`;
  return {
    origin,
    frontend: setting(setting(setting(frontend, 'PORT', frontendPort), 'FRONTEND_ORIGIN', origin), 'API_BACKEND_URL', `http://127.0.0.1:${backendPort}/api`),
    backend: setting(setting(setting(backend, 'PORT', backendPort), 'HOST', '127.0.0.1'), 'CORS_ORIGINS', origin),
  };
}
function prepare(host) {
  const root = path.resolve(__dirname, '..'); const runtime = path.join(root, 'deploy/.runtime');
  const assigned = Object.values(os.networkInterfaces()).flat().some(address => address?.family === 'IPv4' && address.address === host);
  if (!assigned) throw new Error('The requested IP is not assigned to this machine');
  const names = ['frontend.env', 'backend.env', 'nginx.conf', 'manifest.json'];
  const raw = Object.fromEntries(names.map(name => [name, fs.readFileSync(path.join(runtime, name), 'utf8')]));
  const result = runtimeSettings(raw['frontend.env'], raw['backend.env'], host);
  const manifest = JSON.parse(raw['manifest.json'].replace(/^\uFEFF/, ''));
  let nginx = raw['nginx.conf'];
  let cert = nginx.match(/ssl_certificate "([^"]+)";/)?.[1];
  let key = nginx.match(/ssl_certificate_key "([^"]+)";/)?.[1];
  let reuse = false;
  try { const current = new X509Certificate(fs.readFileSync(cert)); reuse = !!current.checkIP(host) && Date.parse(current.validTo) > Date.now() + 86400000 && fs.existsSync(key); } catch { /* Create a matching LAN certificate below. */ }
  if (!reuse) {
    const suffix = Date.now(); cert = path.join(runtime, 'tls', `cert-${suffix}.pem`); key = path.join(runtime, 'tls', `key-${suffix}.pem`);
    const ok = ['openssl', 'C:/Program Files/Git/usr/bin/openssl.exe'].some(binary => spawnSync(binary, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-subj', `/CN=${host}`, '-addext', `subjectAltName=IP:${host},DNS:localhost,IP:127.0.0.1`, '-days', '30'], { windowsHide: true, stdio: 'ignore', timeout: 20000 }).status === 0);
    if (!ok) throw new Error('Cannot create a matching LAN test certificate; runtime unchanged');
  }
  const hostValue = `${host}:3443`;
  nginx = nginx.replace(/server_name [^;]+;/, `server_name ${host};`).replace(/proxy_set_header Host [^;]+;/g, `proxy_set_header Host ${hostValue};`).replace(/proxy_pass http:\/\/127\.0\.0\.1:\d+;/g, 'proxy_pass http://127.0.0.1:3300;').replace(/ssl_certificate "[^"]+";/, `ssl_certificate "${cert.replaceAll('\\', '/')}";`).replace(/ssl_certificate_key "[^"]+";/, `ssl_certificate_key "${key.replaceAll('\\', '/')}";`);
  fs.writeFileSync(path.join(runtime, `lan-settings-before-${Date.now()}.json`), JSON.stringify(raw), { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(runtime, 'frontend.env'), result.frontend);
  fs.writeFileSync(path.join(runtime, 'backend.env'), result.backend);
  fs.writeFileSync(path.join(runtime, 'nginx.conf'), nginx);
  fs.writeFileSync(path.join(runtime, 'manifest.json'), JSON.stringify({ ...manifest, origin: result.origin, frontendPort: 3300, backendPort: 3310 }, null, 2));
  const local = path.join(root, '.env.local'); if (fs.existsSync(local)) fs.writeFileSync(local, setting(fs.readFileSync(local, 'utf8'), 'DEV_LOGIN_GATEWAY_ORIGIN', result.origin));
  return { origin: result.origin, frontendPort: 3300, backendPort: 3310, certificateReused: reuse, secretsPreserved: true };
}
if (require.main === module) {
  try { const host = process.argv.find(argument => argument.startsWith('--host='))?.slice(7); if (!host) throw new Error('Usage: node scripts/prepare-lan-runtime.cjs --host=YOUR_ASSIGNED_LAN_IP'); console.log(JSON.stringify(prepare(host))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { runtimeSettings };
