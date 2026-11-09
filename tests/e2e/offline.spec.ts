import {test,expect} from '@playwright/test';
// The fixture uses its own self-signed TLS endpoint; Chrome otherwise refuses
// service-worker installation even when Playwright ignores navigation errors.
test.use({launchOptions:{args:['--ignore-certificate-errors']}});
const snapshot={ownerId:2,ownerName:'Offline fixture',expiresAt:0,tasks:[{id:101,title:'Private operational fixture',progress:0,status:'todo',locked:false,snapshotProof:'only-fixture-proof',items:[{id:1001,title:'Confirm equipment availability',completed:false,type:'tick',editable:true},{id:1002,title:'Internal acknowledgment',completed:false,type:'signature',editable:false}]}]};
test('encrypted offline vault supports reload, rejects a wrong phrase and cannot be resurrected after discard',async({page})=>{
 await page.goto('/offline.html');
 const source={...snapshot,expiresAt:Date.now()+86400000};
 await page.evaluate(async data=>{const modulePath:string='/offline-vault.js';const vault=await import(/* webpackIgnore: true */modulePath);await vault.createVault(data,'Separate offline phrase 2026');},source);
 await page.locator('#phrase').fill('Wrong offline phrase');await page.getByRole('button',{name:'Mở bản lưu trên thiết bị'}).click();await expect(page.locator('#message')).toContainText('không đúng');
 await page.locator('#phrase').fill('Separate offline phrase 2026');await page.getByRole('button',{name:'Mở bản lưu trên thiết bị'}).click();await expect(page.getByRole('heading',{name:'Private operational fixture'})).toBeVisible();await expect(page.getByRole('checkbox',{name:'Internal acknowledgment'})).toBeDisabled();
 await page.getByRole('checkbox',{name:'Confirm equipment availability'}).check();await expect(page.locator('#summary')).toContainText('1 thay đổi');
 const raw=await page.evaluate(async()=>{const modulePath:string='/offline-vault.js';const vault=await import(/* webpackIgnore: true */modulePath);const state=await vault.unlock('Separate offline phrase 2026');const data=JSON.stringify({...state.record,cipher:Array.from(new Uint8Array(state.record.cipher))});return {data,secretStored:Object.keys(state.record).some(key=>/key|password|phrase/.test(key))};});expect(raw.data).not.toContain('Private operational fixture');expect(raw.data).not.toContain('only-fixture-proof');expect(raw.secretStored).toBe(false);
 await page.reload();await page.locator('#phrase').fill('Separate offline phrase 2026');await page.getByRole('button',{name:'Mở bản lưu trên thiết bị'}).click();await expect(page.getByRole('checkbox',{name:'Confirm equipment availability'})).toBeChecked();
 const revoked=await page.evaluate(async()=>{const modulePath:string='/offline-vault.js';const vault=await import(/* webpackIgnore: true */modulePath);const state=await vault.unlock('Separate offline phrase 2026');await vault.discard();try{await vault.saveUnlocked(state.record,state.payload,state.key);return false;}catch{return (await vault.metadata())===null;}});expect(revoked).toBe(true);
});
test('static offline screen and modules work through the service worker without caching authenticated pages',async({page,context})=>{
 await page.goto('/offline.html');await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});await page.reload();
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await page.evaluate(async data=>{const modulePath:string='/offline-vault.js';const vault=await import(/* webpackIgnore: true */modulePath);await vault.createVault({...data,expiresAt:Date.now()+86400000},'Separate offline phrase 2026');},snapshot);
 await context.setOffline(true);await page.goto('/checklist');await expect(page.getByRole('heading',{name:'Công việc ngoại tuyến'})).toBeVisible();await page.locator('#phrase').fill('Separate offline phrase 2026');await page.getByRole('button',{name:'Mở bản lưu trên thiết bị'}).click();await expect(page.getByRole('heading',{name:'Private operational fixture'})).toBeVisible();
 const keys=await page.evaluate(async()=>{const names=await caches.keys();const urls=[];for(const name of names){const cache=await caches.open(name);for(const request of await cache.keys())urls.push(new URL(request.url).pathname);}return urls.sort();});expect(keys).toEqual(['/offline-app.js','/offline-vault.js','/offline.css','/offline.html']);await context.setOffline(false);
});
