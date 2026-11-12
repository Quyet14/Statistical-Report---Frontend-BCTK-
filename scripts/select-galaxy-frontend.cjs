// Frontend-only UI selection. It does not migrate or change backend settings.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),runtime=path.join(root,'deploy/.runtime'),build=process.argv.find(arg=>arg.startsWith('--build='))?.slice(8)||'.next-work-release-20261106-galaxy';
if(!/^\.next-work-release-[A-Za-z0-9._-]+$/.test(build))throw Error('Use a dedicated work-release build directory');
const target=path.join(runtime,'frontend.env');if(!fs.existsSync(path.join(root,build,'BUILD_ID')))throw Error('Frontend build is not complete');
const statePath=path.join(runtime,'services.json');
if(fs.existsSync(statePath)){
  const state=JSON.parse(fs.readFileSync(statePath,'utf8').replace(/^\uFEFF/,''));
  if(state.services?.some(service=>service.name==='frontend'))throw Error('Stop the managed frontend before selecting a frontend build');
}
const original=fs.readFileSync(target,'utf8');fs.writeFileSync(path.join(runtime,'galaxy-frontend-before-'+Date.now()+'.env'),original,{flag:'wx',mode:0o600});let next=original;for(const [name,value] of Object.entries({CAREOPS_RELEASE:'work',CAREOPS_WORK_DIST_DIR:build})){const pattern=new RegExp('^'+name+'=.*$','m');next=pattern.test(next)?next.replace(pattern,()=>name+'='+value):next.trimEnd()+'\n'+name+'='+value+'\n';}fs.writeFileSync(target,next);console.log(JSON.stringify({frontendSelected:true,build,backendSettingsChanged:false,databaseChanged:false,fullStackHealthPending:true}));
