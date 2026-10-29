const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { isIP } = require('node:net');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const read = file => fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
const secret = () => randomBytes(48).toString('base64url');
const serialize = env => Object.entries(env).map(([key, value]) => {
  const text = String(value);
  const quote = ["'", '`', '"'].find(candidate => !text.includes(candidate));
  if (!quote || text.includes('\0')) throw new Error(`Không thể mã hóa an toàn biến ${key} vào env file`);
  const encoded = `${key}=${quote}${text}${quote}`;
  if (dotenv.parse(encoded)[key] !== text) throw new Error(`Giá trị ${key} không giữ nguyên khi mã hóa env`);
  return encoded;
}).join('\n') + '\n';
function check(front, back) {
  const errors = [];
  if (front.NODE_ENV !== 'production' || back.NODE_ENV !== 'production') errors.push('NODE_ENV cần production trong bộ cấu hình triển khai');
  let origin;
  try { origin = new URL(front.FRONTEND_ORIGIN); if (origin.protocol !== 'https:' || origin.origin !== front.FRONTEND_ORIGIN) errors.push('FRONTEND_ORIGIN phải là HTTPS origin chính xác'); } catch { errors.push('Thiếu FRONTEND_ORIGIN'); }
  try { const url = new URL(front.API_BACKEND_URL); if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) errors.push('API_BACKEND_URL cần HTTPS hoặc loopback'); } catch { errors.push('Thiếu API_BACKEND_URL hợp lệ'); }
  if (front.TRUSTED_EDGE_ENABLED !== 'true') errors.push('TRUSTED_EDGE_ENABLED cần true');
  if (Buffer.byteLength(front.TRUSTED_EDGE_SECRET || '') < 32) errors.push('Thiếu TRUSTED_EDGE_SECRET an toàn');
  if (Buffer.byteLength(front.BFF_PROXY_SECRET || '') < 32 || front.BFF_PROXY_SECRET !== back.BFF_PROXY_SECRET) errors.push('BFF_PROXY_SECRET phải đủ dài và giống nhau ở Next/Nest');
  if (front.BFF_PROXY_SECRET === front.TRUSTED_EDGE_SECRET || back.JWT_SECRET === back.BFF_PROXY_SECRET) errors.push('Các secret phải độc lập');
  if (Buffer.byteLength(back.JWT_SECRET || '') < 32) errors.push('Thiếu JWT_SECRET an toàn');
  try { if (!['redis:', 'rediss:'].includes(new URL(back.RATE_LIMIT_REDIS_URL).protocol)) errors.push('RATE_LIMIT_REDIS_URL không hợp lệ'); } catch { errors.push('Thiếu RATE_LIMIT_REDIS_URL'); }
  if (!back.DB_HOST || !back.DB_USERNAME || !(back.DB_DATABASE || back.DB_NAME)) errors.push('Thiếu cấu hình DB');
  if (!back.SMTP_HOST || !back.SMTP_USER || !back.SMTP_PASS) errors.push('Thiếu cấu hình SMTP');
  if (back.DB_SYNCHRONIZE !== 'false') errors.push('DB_SYNCHRONIZE cần false');
  return errors;
}
function generate({ origin: originText, backendDir, outDir, lan = false, certFile, keyFile }) {
  const origin = new URL(originText);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Dùng HTTPS origin, ví dụ https://192.168.81.178:3443');
  const destination = path.resolve(outDir);
  if (!destination.startsWith(root + path.sep)) throw new Error('Output phải nằm trong frontend workspace');
  if (fs.existsSync(destination) && fs.readdirSync(destination).length) throw new Error('Thư mục cấu hình đã có dữ liệu; không tự ghi đè hoặc đổi secret');
  const existing = read(path.join(backendDir, '.env'));
  const bff = secret(), edge = secret(), redis = secret();
  const frontend = { NODE_ENV: 'production', PORT: 3000, API_BACKEND_URL: 'http://127.0.0.1:3010/api', FRONTEND_ORIGIN: origin.origin, TRUSTED_EDGE_ENABLED: 'true', TRUSTED_EDGE_SECRET: edge, BFF_PROXY_SECRET: bff };
  const backend = { ...existing, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: 3010, JWT_SECRET: secret(), BFF_PROXY_SECRET: bff, CORS_ORIGINS: origin.origin, TRUSTED_PROXIES: '', OTP_ENABLED: 'true', DB_SYNCHRONIZE: 'false', RATE_LIMIT_REDIS_URL: `redis://:${redis}@127.0.0.1:6379`, RATE_LIMIT_PREFIX: `careops:${origin.hostname}:` };
  const errors = check(frontend, backend); if (errors.length) throw new Error(errors.join('; '));
  if (!lan && (!certFile || !keyFile || !fs.existsSync(certFile) || !fs.existsSync(keyFile))) throw new Error('Server nội bộ cần certificate/key từ CA tin cậy; kiểm thử tự ký phải thêm --lan');
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  const write = (name, value) => fs.writeFileSync(path.join(destination, name), value, { flag: 'wx', mode: 0o600 });
  write('frontend.env', serialize(frontend)); write('backend.env', serialize(backend));
  const tlsDir = path.join(destination, 'tls'); fs.mkdirSync(tlsDir, { mode: 0o700 });
  const tlsKey = path.join(tlsDir, 'key.pem'), tlsCert = path.join(tlsDir, 'cert.pem');
  if (lan) {
    const host = origin.hostname.replace(/[\[\]]/g, '');
    if (!isIP(host) && !/^[a-zA-Z0-9.-]+$/.test(host)) throw new Error('Hostname không hợp lệ');
    const san = isIP(host) ? `IP:${host},DNS:localhost,IP:127.0.0.1` : `DNS:${host},DNS:localhost,IP:127.0.0.1`;
    const candidates = [process.env.OPENSSL_BIN, 'openssl', ...(process.platform === 'win32' ? ['C:/Program Files/Git/usr/bin/openssl.exe'] : [])].filter(Boolean);
    if (!candidates.some(binary => spawnSync(binary, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', tlsKey, '-out', tlsCert, '-subj', `/CN=${host}`, '-addext', `subjectAltName=${san}`, '-days', '30'], { windowsHide: true, stdio: 'ignore', timeout: 20000 }).status === 0)) throw new Error('Không tạo được chứng chỉ LAN; cài OpenSSL hoặc khai báo OPENSSL_BIN');
  } else { fs.copyFileSync(certFile, tlsCert, fs.constants.COPYFILE_EXCL); fs.copyFileSync(keyFile, tlsKey, fs.constants.COPYFILE_EXCL); }
  write('redis.conf', `bind 0.0.0.0\nprotected-mode yes\nrequirepass ${redis}\nappendonly yes\nappendfsync everysec\ndir /data\n`);
  write('redis.compose.yml', `services:\n  redis:\n    image: redis:8-alpine@sha256:47b08295737773de3b711fb86f13ae802f5074e96a9a2d29f5f80164ac08c046\n    restart: unless-stopped\n    ports: ["127.0.0.1:6379:6379"]\n    command: ["redis-server", "/usr/local/etc/redis/redis.conf"]\n    volumes:\n      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro\n      - redis-data:/data\nvolumes:\n  redis-data:\n`);
  const certPath = tlsCert.replaceAll('\\', '/'), keyPath = tlsKey.replaceAll('\\', '/');
  write('nginx.conf', `events {}\nhttp {\n  server {\n    listen ${origin.port || 443} ssl;\n    server_name ${origin.hostname};\n    ssl_certificate "${certPath}";\n    ssl_certificate_key "${keyPath}";\n    ssl_protocols TLSv1.2 TLSv1.3;\n    client_max_body_size 64k;\n    location / {\n      proxy_pass http://127.0.0.1:3000;\n      proxy_http_version 1.1;\n      proxy_set_header Host ${origin.host};\n      proxy_set_header X-Forwarded-Proto https;\n      proxy_set_header X-CareOps-Client-IP $remote_addr;\n      proxy_set_header X-CareOps-Edge-Key "${edge}";\n      proxy_set_header X-Forwarded-For "";\n      proxy_set_header Forwarded "";\n      proxy_set_header X-Real-IP "";\n      proxy_set_header X-CareOps-Forwarded-At "";\n      proxy_set_header X-CareOps-Forwarded-Signature "";\n    }\n  }\n}\n`);
  write('manifest.json', JSON.stringify({ origin: origin.origin, backendDir: path.resolve(backendDir), certificate: lan ? 'self-signed-LAN-test-only' : 'provided-by-operator', createdAt: new Date().toISOString() }, null, 2));
  return { origin: origin.origin, directory: destination, selfSigned: lan };
}
if (require.main === module) {
  const args = process.argv.slice(2); const value = key => args.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
  const backendDir = path.resolve(value('backend-dir') || path.join(root, '../bctk-backend-bvhn'));
  const outDir = path.resolve(value('out') || path.join(root, 'deploy/.runtime'));
  try {
    if (args.includes('--generate')) console.log(JSON.stringify(generate({ origin: value('origin'), backendDir, outDir, lan: args.includes('--lan'), certFile: value('cert'), keyFile: value('key') })));
    else {
      const generated = args.includes('--generated');
      const front = generated ? read(path.join(outDir, 'frontend.env')) : { ...read(path.join(root, '.env')), ...read(path.join(root, '.env.local')) };
      const back = generated ? read(path.join(outDir, 'backend.env')) : read(path.join(backendDir, '.env'));
      const errors = check(front, back); console.log(JSON.stringify({ ready: errors.length === 0, issues: errors })); if (errors.length) process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { check, generate, serialize };
