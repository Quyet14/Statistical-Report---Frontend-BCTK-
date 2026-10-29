const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function temporaryCertificate(host = 'localhost') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'careops-e2e-'));
  const key = path.join(directory, 'key.pem');
  const cert = path.join(directory, 'cert.pem');
  const candidates = [process.env.OPENSSL_BIN, 'openssl', ...(process.platform === 'win32' ? ['C:/Program Files/Git/usr/bin/openssl.exe'] : [])].filter(Boolean);
  let success = false;
  for (const binary of candidates) {
    const run = spawnSync(binary, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-subj', `/CN=${host}`, '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-days', '1'], { stdio: 'ignore', windowsHide: true, timeout: 15000 });
    if (run.status === 0) { success = true; break; }
  }
  const cleanup = () => {
    for (const file of [key, cert]) { try { fs.unlinkSync(file); } catch { /* Already removed. */ } }
    try { fs.rmdirSync(directory); } catch { /* No recursive removal. */ }
  };
  if (!success) { cleanup(); throw new Error('OpenSSL is required for isolated HTTPS tests; set OPENSSL_BIN if needed.'); }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert), cleanup };
}
module.exports = { temporaryCertificate };
