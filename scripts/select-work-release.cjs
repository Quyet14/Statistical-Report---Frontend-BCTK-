const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const root = path.resolve(__dirname, "..");
const directory = path.join(root, "deploy/.runtime");
const read = (file) => fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
function set(text, name, value) {
  const pattern = new RegExp("^" + name + "=.*$", "m");
  return pattern.test(text)
    ? text.replace(pattern, () => name + "=" + value)
    : text.trimEnd() + "\n" + name + "=" + value + "\n";
}
async function main() {
  const manifest = JSON.parse(read(path.join(directory, "manifest.json")));
  const files = {
    frontend: path.join(directory, "frontend.env"),
    backend: path.join(directory, "backend.env"),
  };
  const raw = Object.fromEntries(
    Object.entries(files).map(([name, file]) => [name, read(file)]),
  );
  const env = dotenv.parse(raw.backend);
  const frontendEnv = dotenv.parse(raw.frontend);
  const configuredDistDir = frontendEnv.CAREOPS_WORK_DIST_DIR;
  if (
    configuredDistDir &&
    !/^\.next-work-release(?:-[A-Za-z0-9._-]+)?$/.test(configuredDistDir)
  )
    throw new Error("Invalid CAREOPS_WORK_DIST_DIR");
  const frontendDistDir =
    frontendEnv.CAREOPS_RELEASE === "work" && configuredDistDir
      ? configuredDistDir
      : ".next-work-release";
  const frontendBuild = path.join(root, frontendDistDir, "BUILD_ID");
  const configuredBackendDir = env.CAREOPS_WORK_BACKEND_DIR;
  if (
    configuredBackendDir &&
    !/^dist-work-release(?:-[A-Za-z0-9._-]+)?$/.test(configuredBackendDir)
  )
    throw new Error("Invalid CAREOPS_WORK_BACKEND_DIR");
  const backendDistDir =
    env.CAREOPS_RELEASE === "work" && configuredBackendDir
      ? configuredBackendDir
      : "dist-work-release";
  const backendBuild = path.join(
    manifest.backendDir,
    backendDistDir,
    "main.js",
  );
  const buildsReady =
    fs.existsSync(frontendBuild) && fs.existsSync(backendBuild);
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE || env.DB_NAME,
    connectTimeout: 10000,
  });
  let schema;
  let advancedSchema = { ready: true, plan: [] };
  try {
    schema = await require(
      path.join(manifest.backendDir, "scripts/work-schema.cjs"),
    ).upgrade(connection, false);
    if (env.ADVANCED_OPERATIONS_ENABLED === "true")
      advancedSchema = await require(
        path.join(
          manifest.backendDir,
          "scripts/advanced-operations-schema.cjs",
        ),
      ).upgrade(connection, false);
  } finally {
    await connection.end();
  }
  const ready = buildsReady && schema.ready && advancedSchema.ready;
  if (process.argv.includes("--activate")) {
    if (!ready)
      throw new Error(
        "Build the releases and apply all enabled additive schemas first",
      );
    if (fs.existsSync(path.join(directory, "services.json")))
      throw new Error(
        "Stop the managed LAN services during the agreed maintenance window first",
      );
    const alreadySelected =
      dotenv.parse(raw.frontend).CAREOPS_RELEASE === "work" &&
      env.CAREOPS_RELEASE === "work" &&
      env.WORK_FOUNDATION_ENABLED === "true";
    if (!alreadySelected) {
      const backup = path.join(directory, "work-release-previous.json");
      fs.writeFileSync(
        backup,
        JSON.stringify({ createdAt: new Date().toISOString(), ...raw }),
        { flag: "wx", mode: 0o600 },
      );
      try {
        fs.writeFileSync(
          files.frontend,
          set(raw.frontend, "CAREOPS_RELEASE", "work"),
        );
        fs.writeFileSync(
          files.backend,
          set(
            set(raw.backend, "CAREOPS_RELEASE", "work"),
            "WORK_FOUNDATION_ENABLED",
            "true",
          ),
        );
      } catch (error) {
        for (const [name, file] of Object.entries(files))
          fs.writeFileSync(file, raw[name]);
        throw error;
      }
    }
    console.log(
      JSON.stringify({
        selected: "work",
        restartRequired: true,
        origin: manifest.origin,
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        ready,
        buildsReady,
        schemaReady: schema.ready,
        advancedSchemaReady: advancedSchema.ready,
        missingAdvancedTables: advancedSchema.plan.length,
        missingTables: schema.plan.length,
        frontendBuildId: buildsReady ? read(frontendBuild).trim() : null,
        selected: dotenv.parse(raw.frontend).CAREOPS_RELEASE || "default",
        origin: manifest.origin,
      }),
    );
    if (!ready) process.exitCode = 1;
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(
      JSON.stringify({
        ready: false,
        code: error.code || "WORK_RELEASE_NOT_READY",
        message: error.code
          ? "Release check failed; inspect local configuration and database connectivity"
          : error.message,
      }),
    );
    process.exitCode = 1;
  });
module.exports = { set };
