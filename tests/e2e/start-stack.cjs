// A fully isolated HTTPS stack. It never connects to the application's DB/SMTP.
const http = require('node:http');
const https = require('node:https');
const { spawn } = require('node:child_process');
const { randomBytes, createHmac, timingSafeEqual } = require('node:crypto');
const path = require('node:path');
const { temporaryCertificate } = require('./tls.cjs');
const edgeSecret = randomBytes(48).toString('hex');
const bffSecret = randomBytes(48).toString('hex');
const token = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
const refreshes = new Map(); let rotation = 0;
let remembered = null;
let administrator = false;
let director = false;
let employee = false;
let kpiPolicies = [], kpiPositions = {}, kpiFrozen = false;
let workTasks = [], workTemplates = [], workAudit = [];
const viewer = () => employee ? staff : director ? { ...user, id: 7, role: 'viewer', name: 'Director fixture', departmentId: null } : administrator ? { ...user, id: 1, role: 'admin', name: 'Admin fixture', departmentId: null } : user;
// Isolate per-client CAPTCHA issuance limits between browser cases without a product bypass.
let fixtureClient = 1;
function deviceTokens() { const value = 'fixture-device-' + (++rotation); remembered.tokens.add(value); return { deviceToken: value, deviceExpiresAt: remembered.expires }; }
function tokens() { const refreshToken = 'fixture-refresh-' + (++rotation); refreshes.set(refreshToken, null); return { user: viewer(), accessToken: token, refreshToken, sessionExpiresAt: Date.now() + 43200000 }; }
const gatewayPort = Number(process.env.E2E_HTTPS_PORT || '3443');
const origin = `https://localhost:${gatewayPort}`;
let expired = false;
let forbidden = false;
const user = { id: 2, name: 'Trưởng khoa thử nghiệm', email: 'manager@example.invalid', role: 'manager', departmentId: 10, isActive: true };
const staff = { id: 3, name: 'Nhân viên thử nghiệm', email: 'staff@example.invalid', role: 'staff', departmentId: 10, isActive: true };
const listen = (server, port) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
function validProof(req) {
  const ip = req.headers['x-careops-client-ip'];
  const at = req.headers['x-careops-forwarded-at'];
  const proof = req.headers['x-careops-forwarded-signature'] || '';
  if (!ip || !at || Math.abs(Date.now() - Number(at)) > 30000 || !/^[a-f0-9]{64}$/.test(proof)) return false;
  return timingSafeEqual(Buffer.from(proof, 'hex'), createHmac('sha256', bffSecret).update(JSON.stringify([req.method, req.url, ip, at])).digest());
}
const backend = http.createServer(async (req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route.startsWith('/__test/')) {
    if (route === '/__test/reset') { expired = false; forbidden = false; refreshes.clear(); remembered = null; administrator = false; director = false; employee = false; kpiPolicies = []; kpiPositions = {}; kpiFrozen = false; workTasks = []; workTemplates = []; workAudit = []; fixtureClient = fixtureClient % 240 + 1; }
    else if (route === '/__test/staff-role') employee = true;
    else if (route === '/__test/director') director = true;
    else if (route === '/__test/admin') administrator = true;
    else if (route === '/__test/edit') workTasks = [{ id: 902, title: 'Công việc cập nhật tiến độ', assignee: staff.name, assigneeId: 3, createdById: 2, departmentId: 10, departmentName: 'Khoa thử nghiệm', status: 'doing', progress: 50, priority: 'medium', dueDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()), isRecurring: true, checklist: [] }];
    else if (route === '/__test/work') workTasks = [{ id: 901, title: 'Kiểm tra chờ phê duyệt', assignee: staff.name, assigneeId: 3, createdById: 2, departmentId: 10, departmentName: 'Khoa thử nghiệm', status: 'doing', progress: 100, priority: 'high', dueDate: new Date().toISOString().slice(0,10), time: new Date().toISOString().slice(0,10), reviewerId: 2, approvalState: 'submitted', locked: true, checklist: [{ id: 3001, title: 'Kiểm tra thực tế', completed: true }] }];
    else if (route === '/__test/expire') expired = true;
    else if (route === '/__test/forbidden') forbidden = true;
    res.writeHead(200); res.end('OK'); return;
  }
  if (!validProof(req)) { res.writeHead(403); res.end('Invalid signed client assertion'); return; }
  let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 65536) { res.writeHead(413); res.end(); return; } }
  const body = text ? JSON.parse(text) : {};
  let data = []; let status = 200;
  if (route === '/api/auth/login') {
    if (body.email === 'rate@example.invalid') { status = 429; res.setHeader('Retry-After', '4'); data = { message: 'Too many requests' }; }
    else if (remembered?.tokens.has(body.deviceToken)) { expired = false; remembered.autoLogin = body.rememberDevice === true; data = { ...tokens(), ...deviceTokens() }; if (!body.rememberDevice) { remembered = null; delete data.deviceToken; delete data.deviceExpiresAt; } }
    else data = { message: 'Nhập mã xác minh thử nghiệm', email: body.email };
  } else if (route === '/api/auth/verify-login-otp') {
    if (body.otp !== '123456') { status = 401; data = { message: 'Invalid OTP' }; }
    else { expired = false; remembered = body.rememberDevice === true ? { tokens: new Set(), autoLogin: true, expires: Date.now() + 30 * 86400000 } : null; data = { ...tokens(), ...(remembered ? deviceTokens() : {}) }; }
  } else if (route === '/api/auth/device-status') {
    data = { remembered: !!remembered?.tokens.has(body.deviceToken), autoLogin: !!(remembered?.tokens.has(body.deviceToken) && remembered.autoLogin), expiresAt: remembered?.expires };
  } else if (route === '/api/auth/resume-device') {
    if (!remembered?.tokens.has(body.deviceToken) || !remembered.autoLogin) { status = 401; data = { message: 'Password sign-in required' }; }
    else { expired = false; data = { ...tokens(), ...deviceTokens() }; }
  } else if (route === '/api/auth/refresh') {
    if (expired || !refreshes.has(body.refreshToken)) { status = 401; data = { message: 'Expired' }; }
    else { data = refreshes.get(body.refreshToken) || tokens(); refreshes.set(body.refreshToken, data); }
  } else if (route === '/api/auth/logout') {
    if (remembered?.tokens.has(body.deviceToken)) remembered.autoLogin = false;
    expired = true; refreshes.clear(); data = { message: 'Logged out' };
  } else if (route === '/api/auth/end-session') {
    expired = true; refreshes.clear(); data = { message: 'Idle' };
  } else if (route === '/api/auth/forget-device') {
    remembered = null; expired = true; refreshes.clear(); data = { message: 'Forgotten' };
  } else if (route === '/api/auth/forgot-password') data = { message: 'If eligible, an OTP was sent.', email: body.email };
  else if (expired || req.headers.authorization !== `Bearer ${token}`) { status = 401; data = { message: 'Expired' }; }
  else if (route === '/api/auth/me' && forbidden) { status = 403; data = { message: 'Forbidden' }; }
  else if (route === '/api/auth/me' || route === '/api/users/1') data = viewer();
  else if (route === '/api/users/2') data = user;
  else if (route === '/api/users/3') data = staff;
  else if (route === '/api/users/7') data = viewer();
  else if (route === '/api/users') data = [user, staff];
  else if (route === '/api/users/managed') data = [staff];
  else if (route === '/api/departments') data = [{ id: 10, name: 'Khoa Nội', branchId: 1 }];
  else if (route === '/api/departments/10') data = { id: 10, name: 'Khoa Nội', branchId: 1 };
  else if (route === '/api/tasks') data = workTasks;
  else if (/^\/api\/tasks\/\d+$/.test(route)) { data = workTasks.find(task => task.id === Number(route.split('/').pop())) || {}; if (req.method === 'PATCH') Object.assign(data, body); }
  else if (route === '/api/work/capabilities') data = { enabled: true };
  else if (route === '/api/work/lookups') data = { assignees: [user, staff], reviewers: [viewer()] };
  else if (route === '/api/work/tasks') { const query = new URL(req.url, origin).searchParams; const items = workTasks.filter(task => !query.get('approvalState') || query.get('approvalState') === task.approvalState); data = { items, total: items.length, page: 1, limit: 25 }; }
  else if (/^\/api\/work\/tasks\/\d+\/review$/.test(route)) { const task = workTasks.find(task => task.id === Number(route.split('/')[4])); task.approvalState = body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : 'draft'; task.status = body.action === 'approve' ? 'done' : 'doing'; task.locked = body.action === 'approve'; workAudit.unshift({ id: workAudit.length + 1, actorName: viewer().name, action: body.action, summary: task.title, createdAt: new Date().toISOString(), beforeData: { approvalState: 'submitted' }, afterData: { approvalState: task.approvalState } }); data = task; }
  else if (route === '/api/work/templates') { if (req.method === 'POST') { const template = { ...body, id: workTemplates.length + 1, version: 1, anchorDate: body.startDate, nextRun: body.startDate }; workTemplates.push(template); data = { id: template.id, version: 1 }; } else data = workTemplates; }
  else if (/^\/api\/work\/templates\/\d+$/.test(route)) { const template = workTemplates.find(item => item.id === Number(route.split('/').pop())); Object.assign(template, body, { version: template.version + 1 }); data = { id: template.id, version: template.version }; }
  else if (route === '/api/work/activity') data = { items: workAudit, total: workAudit.length, page: 1, limit: 25 };
  else if (route === '/api/work/generate') data = { generated: 0 };
  else if (route === '/api/kpi/capabilities') data = { policies: true, history: true };
  else if (route === '/api/kpi/policies') { if (req.method === 'POST') { const record = { ...body, id: kpiPolicies.length + 1, version: kpiPolicies.length + 1 }; kpiPolicies.push(record); data = { id: record.id, version: record.version }; } else data = { policies: kpiPolicies, departments: [{id:10,name:'Khoa Nội'}], people: [{...staff,position:kpiPositions[3] || ''}] }; }
  else if (/^\/api\/kpi\/assignments\/\d+$/.test(route)) { kpiPositions[Number(route.split('/').pop())] = body.position; data = { position: body.position }; }
  else if (route === '/api/kpi/ranking') data = [{ userId: 3, name: staff.name, departmentId: 10, score: 90, totalCount: 3, completedCount: 2, lateCount: 1, frozen: kpiFrozen, policyTitle: 'Công thức thử nghiệm' }];
  else if (/^\/api\/kpi\/history\/\d+$/.test(route)) data = [{ id:1,periodType:'month',periodValue:'2026-10-01',result:{score:82.5,policyTitle:'Công thức kỳ trước',completedCount:4,totalCount:5} }];
  else if (route === '/api/kpi/snapshots') { kpiFrozen = true; data = {created:1,existing:0}; }
  else if (route === '/api/reports') { const task = { id: '701', title: 'Báo cáo thử nghiệm', assignee: staff.name, department: 'Khoa test', departmentName: 'Khoa test', time: new URL(req.url, origin).searchParams.get('date'), dueDate: new URL(req.url, origin).searchParams.get('date'), status: 'done', progress: 100, priority: 'Medium' }; data = { data: { totalTasks: 1, completedTasks: 1, lateTasks: 0, avgScore: 100, tasks: [task], chartData: [], categories: [], highlights: [], onTimeTasks: 1, completionDateUnknown: 0, comparison: { previousTotal: 1, completionRateDelta: 20 } } }; }
  res.writeHead(status, { 'Content-Type': 'application/json', 'X-CareOps-Backend': 'nest-v1' }); res.end(JSON.stringify(data));
});

async function main() {
  const certificate = temporaryCertificate();
  await listen(backend, 3025);
  const child = spawn(process.execPath, ['--require', path.resolve('tests/e2e/captcha-random.cjs'), path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3005'], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', API_BACKEND_URL: 'http://127.0.0.1:3025/api', FRONTEND_ORIGIN: origin, TRUSTED_EDGE_ENABLED: 'true', TRUSTED_EDGE_SECRET: edgeSecret, BFF_PROXY_SECRET: bffSecret },
  });
  child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
  const gateway = https.createServer(certificate, (req, res) => {
    const headers = { ...req.headers, host: `localhost:${gatewayPort}`, 'x-forwarded-proto': 'https', 'x-careops-edge-key': edgeSecret, 'x-careops-client-ip': `127.0.0.${fixtureClient}` };
    for (const name of ['x-forwarded-for', 'forwarded', 'x-real-ip', 'x-careops-forwarded-at', 'x-careops-forwarded-signature']) delete headers[name];
    const upstream = http.request({ hostname: '127.0.0.1', port: 3005, path: req.url, method: req.method, headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on('error', () => { res.writeHead(502); res.end('Isolated fixture is starting'); }); req.pipe(upstream);
  });
  const shutdown = () => { child.kill(); gateway.close(); backend.close(); certificate.cleanup(); };
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });
  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('exit', shutdown);
  child.once('exit', code => { if (code) { console.error('Isolated Next server exited'); process.exit(1); } });
  await listen(gateway, gatewayPort);
  console.log(`Isolated HTTPS test stack listening on ${gatewayPort}`);
}
main().catch(error => { console.error(error.message); process.exit(1); });
