const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function tsLoader(globals = {}) {
  const cache = new Map();
  function load(file) {
    let resolved = path.resolve(__dirname, '../..', file);
    if (!path.extname(resolved)) resolved = fs.existsSync(`${resolved}.ts`) ? `${resolved}.ts` : path.join(resolved, 'index.ts');
    if (cache.has(resolved)) return cache.get(resolved);
    const exports = {}; cache.set(resolved, exports);
    const requireFrom = (name) => name.startsWith('.') ? load(path.resolve(path.dirname(resolved), name)) : require(name);
    const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, require: requireFrom, Error, URL, Response, Request, Headers, AbortSignal, TextEncoder, TextDecoder, Uint8Array, Buffer, process: { env: { NODE_ENV: 'test' } }, ...globals }, { filename: resolved });
    return exports;
  }
  return load;
}
module.exports = { tsLoader };
