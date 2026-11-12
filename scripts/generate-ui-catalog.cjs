const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const ts = require("typescript");

const frontendRoot = path.resolve(__dirname, "..");
const backendArgument = process.argv
  .slice(2)
  .find((value) => value.startsWith("--backend="))
  ?.slice("--backend=".length);
const backendRoot =
  backendArgument ||
  path.resolve(frontendRoot, "..", "bctk-backend-bvhn");
const sourceRoot = path.join(frontendRoot, "src");
const target = new Map();

function hasVietnameseDiacritics(value) {
  return /[\u0300-\u036f]/.test(value.normalize("NFD"));
}

function add(value) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (
    normalized.length < 2 ||
    normalized.length > 300 ||
    !hasVietnameseDiacritics(normalized)
  )
    return;
  const key = `literal.${createHash("sha1")
    .update(normalized)
    .digest("hex")
    .slice(0, 32)}`;
  target.set(normalized, key);
}

function visitNode(node) {
  if (ts.isJsxText(node)) add(node.text);
  if (ts.isStringLiteral(node)) add(node.text);
  if (ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
  if (ts.isTemplateExpression(node)) {
    add(node.head.text);
    for (const span of node.templateSpans) add(span.literal.text);
  }
  if (ts.isJsxAttribute(node) && node.initializer) {
    if (ts.isStringLiteral(node.initializer)) add(node.initializer.text);
  }
  ts.forEachChild(node, visitNode);
}

function visitDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visitDirectory(filename);
      continue;
    }
    if (
      !filename.endsWith(".tsx") &&
      path.relative(sourceRoot, filename) !== path.join("lib", "presentation.ts")
    )
      continue;
    const source = ts.createSourceFile(
      filename,
      fs.readFileSync(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    visitNode(source);
  }
}

visitDirectory(sourceRoot);

const frontendMap = Object.fromEntries(
  [...target.entries()].map(([source, key]) => [source, key]),
);
const backendMap = Object.fromEntries(
  [...target.entries()].map(([source, key]) => [key, source]),
);
const frontendFile = path.join(
  sourceRoot,
  "i18n",
  "ui-literal-keys.ts",
);
const backendFile = path.join(
  backendRoot,
  "src",
  "i18n",
  "ui-literal.catalog.ts",
);

fs.writeFileSync(
  frontendFile,
  `export const UI_LITERAL_KEYS: Record<string, string> = ${JSON.stringify(frontendMap, null, 2)};\n`,
);
fs.writeFileSync(
  backendFile,
  `export const UI_LITERAL_STRINGS: Record<string, string> = ${JSON.stringify(backendMap, null, 2)};\n`,
);
console.log(
  JSON.stringify({
    translatedLabels: target.size,
    frontendCatalog: frontendFile,
    backendCatalog: backendFile,
  }),
);
