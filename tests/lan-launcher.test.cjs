const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

test('gateway recovery preserves an existing listener and the service ledger', { skip: process.platform !== 'win32' }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'careops-gateway-'));
  const server = net.createServer(socket => socket.end());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const state = '{"services":[{"name":"backend","pid":123,"managed":false}],"gatewayPid":456}';
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ origin: `https://127.0.0.1:${server.address().port}` }));
  fs.writeFileSync(path.join(directory, 'services.json'), state);
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/lan-services.ps1'), '-Action', 'ensure-gateway', '-ConfigDirectory', directory], { windowsHide: true });
      let output = '';
      child.stdout.on('data', data => output += data);
      child.stderr.on('data', data => output += data);
      child.on('error', reject);
      child.on('exit', code => resolve({ code, output }));
    });
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /no process was changed/);
    assert.equal(fs.readFileSync(path.join(directory, 'services.json'), 'utf8'), state);
    assert.equal(server.listening, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.unlinkSync(path.join(directory, 'manifest.json'));
    fs.unlinkSync(path.join(directory, 'services.json'));
    fs.rmdirSync(directory);
  }
});

test('LAN preflight rejects an occupied port without stopping its owner or rewriting state', { skip: process.platform !== 'win32' }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'careops-port-'));
  const server = net.createServer(socket => socket.end('still-running'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const state = '{"services":[],"test":"unchanged"}';
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ frontendPort: port }));
  fs.writeFileSync(path.join(directory, 'services.json'), state);
  const run = () => new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/lan-services.ps1'), '-Action', 'preflight', '-Service', 'frontend', '-ConfigDirectory', directory], { windowsHide: true });
    let output = '';
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => output += data);
    child.on('error', reject);
    child.on('exit', code => resolve({ code, output }));
  });
  try {
    const conflict = await run();
    assert.notEqual(conflict.code, 0);
    assert.match(conflict.output, /already occupied/);
    assert.equal(fs.readFileSync(path.join(directory, 'services.json'), 'utf8'), state);
    const response = await new Promise((resolve, reject) => {
      const client = net.connect(port, '127.0.0.1');
      client.on('data', data => resolve(data.toString()));
      client.on('error', reject);
    });
    assert.equal(response, 'still-running');
    await new Promise(resolve => server.close(resolve));
    const available = await run();
    assert.equal(available.code, 0, available.output);
    assert.match(available.output, /ports are available/);
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
