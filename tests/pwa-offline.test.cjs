const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicPath = (name) => path.join(__dirname, "../public", name);

test("installable PWA caches only the public shell and keeps private data outside CacheStorage", () => {
  const manifest = JSON.parse(fs.readFileSync(publicPath("manifest.webmanifest"), "utf8"));
  const worker = fs.readFileSync(publicPath("sw.js"), "utf8");
  const offline = fs.readFileSync(publicPath("offline.html"), "utf8");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/checklist");
  for (const icon of manifest.icons) {
    const bytes = fs.readFileSync(publicPath(icon.src.slice(1)));
    assert.equal(bytes.readUInt32BE(16), Number(icon.sizes.split("x")[0]));
    assert.equal(bytes.readUInt32BE(20), Number(icon.sizes.split("x")[1]));
  }
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /request\.method !== "GET"/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /cache\.put\(url, response\)/);
  assert.doesNotMatch(worker, /cache\.put\(\s*request/);
  assert.match(worker, /const SHELL = \[\s*OFFLINE_URL,\s*"\/offline\.css",\s*"\/offline-app\.js",\s*"\/offline-vault\.js",?\s*\]/);
  assert.match(offline, /script type="module" src="\/offline-app.js"/);
  assert.doesNotMatch(offline, /<style|onclick=|<script>/);
  assert.match(offline.replace(/\s+/g, " "), /Thay đổi chỉ được ghi nhận trên máy chủ sau khi đồng bộ thành công/);
});
