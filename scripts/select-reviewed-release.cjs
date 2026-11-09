const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, 'deploy/.runtime');
const frontendDirectory = '.next-work-release-20261104-dependencies-ui';
const backendDirectory = 'dist-work-release-20261104-dependencies';
const read = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
function setting(text, key, value) {
  const pattern = new RegExp('^' + key + '=.*$', 'm');
  return pattern.test(text) ? text.replace(pattern, () => key + '=' + value) : text.trimEnd() + '\n' + key + '=' + value + '\n';
}
async function main() {
  const manifest = JSON.parse(read(path.join(runtime, 'manifest.json')));
  const files = {frontend:path.join(runtime,'frontend.env'),backend:path.join(runtime,'backend.env')};
  const raw = Object.fromEntries(Object.entries(files).map(([name,file])=>[name,read(file)]));
  const env = dotenv.parse(raw.backend);
  const buildId = path.join(root, frontendDirectory, 'BUILD_ID');
  const buildsReady = fs.existsSync(buildId) && fs.existsSync(path.join(manifest.backendDir,backendDirectory,'main.js')) && fs.existsSync(path.join(manifest.backendDir,backendDirectory,'kpi/kpi-policy.controller.js')) && fs.existsSync(path.join(manifest.backendDir,backendDirectory,'work/task-dependencies.controller.js'));
  const db = await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT||3306),user:env.DB_USERNAME,password:env.DB_PASSWORD,database:env.DB_DATABASE||env.DB_NAME,connectTimeout:10000});
  const schemas = {};
  let evidenceRecords=0;
  try {
    for(const [name,script] of Object.entries({work:'work-schema.cjs',organization:'organization-schema.cjs',kpi:'kpi-policy-schema.cjs',advanced:'advanced-operations-schema.cjs',dependencies:'dependency-schema.cjs'})) {
      const result = await require(path.join(manifest.backendDir,'scripts',script)).upgrade(db,false);
      schemas[name] = {ready:result.ready,missingStatements:result.plan.length};
    }
    const [columns]=await db.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME IN ('employeeCode','mustChangePassword')");
    const [indexes]=await db.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='employeeCode' AND NON_UNIQUE=0");
    schemas.employeeImport={ready:columns.length===2&&indexes.length>0,missingStatements:columns.length===2&&indexes.length>0?0:1};
    const [tables]=await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='task_evidence'");
    schemas.evidence={ready:tables.length===1,missingStatements:tables.length===1?0:1};
    if(tables.length)evidenceRecords=Number((await db.query('SELECT COUNT(*) total FROM task_evidence'))[0][0].total);
  } finally { await db.end(); }
  const ready = buildsReady && Object.values(schemas).every(schema=>schema.ready);
  if(process.argv.includes('--activate')) {
    if(!ready) throw new Error('Review builds and schemas must be ready before activation');
    if(fs.existsSync(path.join(runtime,'services.json'))) throw new Error('Stop managed LAN services before changing the selected release');
    if(evidenceRecords&&!env.TASK_EVIDENCE_STORAGE_DIR)throw new Error('Existing evidence requires its original private storage directory; configure it before activation');
    const storage=env.TASK_EVIDENCE_STORAGE_DIR||path.join(runtime,'task-evidence');
    if(!path.isAbsolute(storage)||path.resolve(storage).startsWith(path.join(root,'public')+path.sep))throw new Error('Evidence storage must be private and absolute');
    const already = dotenv.parse(raw.frontend).CAREOPS_WORK_DIST_DIR===frontendDirectory && env.CAREOPS_WORK_BACKEND_DIR===backendDirectory && env.KPI_POLICIES_ENABLED==='true' && env.EMPLOYEE_IMPORT_ENABLED==='true' && env.TASK_EVIDENCE_ENABLED==='true' && env.TASK_DEPENDENCIES_ENABLED==='true' && !!env.TASK_EVIDENCE_STORAGE_DIR;
    if(!already) {
      fs.writeFileSync(path.join(runtime,'review-release-before-'+Date.now()+'.json'),JSON.stringify({createdAt:new Date().toISOString(),...raw}),{flag:'wx',mode:0o600});
      try {
        fs.writeFileSync(files.frontend,setting(setting(raw.frontend,'CAREOPS_RELEASE','work'),'CAREOPS_WORK_DIST_DIR',frontendDirectory));
        fs.mkdirSync(storage,{recursive:true,mode:0o700});
        const selected=setting(setting(setting(raw.backend,'CAREOPS_RELEASE','work'),'CAREOPS_WORK_BACKEND_DIR',backendDirectory),'KPI_POLICIES_ENABLED','true');
        fs.writeFileSync(files.backend,setting(setting(setting(setting(selected,'EMPLOYEE_IMPORT_ENABLED','true'),'TASK_EVIDENCE_ENABLED','true'),'TASK_EVIDENCE_STORAGE_DIR',storage),'TASK_DEPENDENCIES_ENABLED','true'));
      } catch(error) { for(const [name,file] of Object.entries(files))fs.writeFileSync(file,raw[name]);throw error; }
    }
  }
  console.log(JSON.stringify({ready,buildsReady,schemas,origin:manifest.origin,frontendDirectory,backendDirectory,buildId:buildsReady?read(buildId).trim():null,activated:process.argv.includes('--activate')}));
  if(!ready)process.exitCode=1;
}
main().catch(error=>{console.error(JSON.stringify({ready:false,code:error.code||'RELEASE_CHECK_FAILED',message:error.code?'Release configuration or database check failed':error.message}));process.exitCode=1;});
