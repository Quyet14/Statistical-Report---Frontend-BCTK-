import { test, expect, type Page } from '@playwright/test';
declare global { interface Window { cspViolations?: string[] } }

async function openOtp(page: Page, remember = false) {
  await page.goto('/login');
  await expect(page.locator('.captcha-preview img')).toBeVisible();
  await page.locator('input[type=email]').fill('manager@example.invalid');
  await page.locator('.password-field input').fill('OnlyAFixturePassword-42');
  await page.locator('.password-toggle').click();
  await expect(page.locator('.password-field input')).toHaveAttribute('type', 'text');
  await expect(page.locator('.captcha-preview img')).toBeVisible();
  await page.locator('#login-captcha').fill('222222');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  if (remember) await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(page.locator('.otp-digit')).toHaveCount(6);
  await expect(page.locator('.auth-card-subtitle')).toContainText('ma***@example.invalid');
  await expect(page.locator('.auth-card')).not.toContainText('manager@example.invalid');
}

async function signIn(page: Page, remember = false) {
  await openOtp(page, remember);
  await page.locator('input[autocomplete=one-time-code]').fill('123456');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/auth/verify-login-otp') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Xác nhận và đăng nhập' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(/\/checklist$/);
  await expect(page.locator('.sidebar-usercard')).toBeVisible();
}
test.beforeEach(async ({ request }) => { await request.get('http://127.0.0.1:3025/__test/reset'); });

test('custom report designer saves column order, previews data and creates a disabled delivery schedule',async({page,request})=>{
 await request.get('http://127.0.0.1:3025/__test/admin');let saved:any=null;const schedules:any[]=[];const columnLabels={title:'Công việc',assignee:'Người thực hiện',department:'Khoa/phòng',dueDate:'Hạn thực hiện',progress:'Tiến độ (%)',status:'Trạng thái'};
 await page.route('**/api/reports/builder/**',route=>{const path=new URL(route.request().url()).pathname,method=route.request().method();if(path.endsWith('/capabilities'))return route.fulfill({json:{enabled:true}});if(path.endsWith('/templates')&&method==='POST'){saved={...route.request().postDataJSON(),id:1,version:1,active:true};return route.fulfill({json:{id:1}});}if(path.endsWith('/templates'))return route.fulfill({json:{items:saved?[saved]:[],columns:columnLabels}});if(path.endsWith('/schedules')&&method==='POST'){const body=route.request().postDataJSON();expect(body.active).toBe(false);schedules.push({...body,id:1,version:1,title:saved.title,nextRun:'2026-12-01T07:00:00'});return route.fulfill({json:{id:1}});}if(path.endsWith('/schedules'))return route.fulfill({json:{items:schedules,people:[{id:1,name:'Admin fixture'}],jobs:[],deliveryEnabled:true}});if(path.endsWith('/preview'))return route.fulfill({json:{columns:saved.config.columns.map((key:string)=>({key,label:columnLabels[key as keyof typeof columnLabels]})),rows:[{title:'Scoped report fixture',assignee:'Staff fixture',department:'A',dueDate:'2026-11-05',progress:50,status:'doing'}],total:1,page:1,pageSize:100,bounds:{start:'2026-11-01',end:'2026-11-30'}}});return route.fulfill({status:404,json:{message:'Unexpected fixture route'}});});
 await signIn(page);await page.goto('/reports/templates');await page.getByLabel('Tên mẫu',{exact:true}).fill('Mẫu báo cáo tháng');await page.getByRole('button',{name:'Đưa Công việc xuống',exact:true}).click();await page.getByRole('button',{name:'Lưu mẫu báo cáo',exact:true}).click();await expect(page.getByRole('status')).toContainText('Đã lưu mẫu');expect(saved.config.columns[0]).toBe('assignee');await page.getByRole('button',{name:'Xem trước',exact:true}).click();await expect(page.getByRole('cell',{name:'Scoped report fixture',exact:true})).toBeVisible();await page.getByRole('checkbox',{name:'Admin fixture',exact:true}).check();await page.getByRole('button',{name:'Tạo lịch gửi',exact:true}).click();await expect(page.getByRole('status')).toContainText('trạng thái tắt');await expect(page.getByRole('button',{name:'Kiểm tra & bật lịch',exact:true})).toBeVisible();
});

test('backup operations queues a confirmed verification without replacing live data',async({page,request})=>{
 await request.get('http://127.0.0.1:3025/__test/admin');let requested=false;const id='6e3b96c3-09c5-4f5f-86f8-492967ddc0d1';await page.route('**/api/operations/backups**',route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/capabilities'))return route.fulfill({json:{enabled:true,workerConfigured:true}});if(path.endsWith('/verify')){requested=true;return route.fulfill({json:{id:'fixture-verify',state:'queued'}});}return route.fulfill({json:{policy:{enabled:false,hourVN:2,retentionDays:30,nextRun:'2026-11-06T19:00:00Z'},jobs:[{id,kind:'backup',state:'completed',summary:{tables:3,rows:32,files:1,archiveBytes:1000,verified:true}}]}});});await signIn(page);await page.goto('/settings/operations');await page.getByRole('button',{name:'Kiểm tra khôi phục lại',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Kiểm tra khôi phục bản sao',exact:true});await expect(dialog).toContainText('Không thay cơ sở dữ liệu đang sử dụng');await dialog.getByRole('button',{name:'Xác nhận',exact:true}).click();await expect(page.getByRole('status')).toContainText('Đã ghi nhận yêu cầu');expect(requested).toBe(true);
});

test('global search uses the server scope and opens the matching task detail',async({page,request})=>{
  await request.get('http://127.0.0.1:3025/__test/edit');
  await page.route('**/api/work/search?*',route=>{expect(new URL(route.request().url()).searchParams.get('q')).toBe('Kiểm tra');return route.fulfill({json:{query:'Kiểm tra',page:1,limit:8,groups:[{type:'tasks',total:1,items:[{id:902,title:'Kiểm tra trong khoa',subtitle:'Nhân viên thử nghiệm',href:'/workflow/tasks/902'}]}]}});});
  await signIn(page);const search=page.getByRole('combobox',{name:'Tìm công việc, nhân sự, khoa phòng'});await search.fill('Kiểm tra');await page.getByRole('option',{name:'Kiểm tra trong khoa Công việc · Nhân viên thử nghiệm'}).click();await expect(page).toHaveURL(/\/workflow\/tasks\/902$/);await expect(page.getByRole('heading',{name:'Công việc cập nhật tiến độ',exact:true})).toBeVisible();
});

test('account session management confirms and revokes a different device',async({page})=>{
  let items=[{id:'old-session',current:false,remembered:true,sameDeviceAsCurrent:false,createdAt:new Date().toISOString(),lastActiveAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()},{id:'current-session',current:true,remembered:true,sameDeviceAsCurrent:true,createdAt:new Date().toISOString(),lastActiveAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()}];
  await page.route('**/api/auth/sessions**',route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/capabilities'))return route.fulfill({json:{enabled:true}});if(path.endsWith('/revoke')){items=items.filter(item=>item.id!=='old-session');return route.fulfill({json:{revoked:true}});}return route.fulfill({json:{items}});});
  await signIn(page);await page.goto('/account');await page.getByRole('button',{name:'Kết thúc phiên này',exact:true}).click();await page.getByRole('dialog',{name:'Kết thúc phiên từ xa'}).getByRole('button',{name:'Xác nhận kết thúc phiên',exact:true}).click();await expect(page.getByText('Phiên trình duyệt khác',{exact:true})).toHaveCount(0);await expect(page.getByText('Phiên hiện tại',{exact:true})).toBeVisible();
});

test('KPI quarter and year choices are sent to the server',async({page})=>{
  const periods:string[]=[];await page.route('**/api/kpi/ranking?*',route=>{const period=new URL(route.request().url()).searchParams.get('period')||'';periods.push(period);return route.fulfill({json:[]});});
  await signIn(page);await page.goto('/kpi');const period=page.getByRole('combobox',{name:'Kỳ KPI'});await period.selectOption('quarter');await expect.poll(()=>periods.includes('quarter')).toBe(true);await period.selectOption('year');await expect.poll(()=>periods.includes('year')).toBe(true);
});

test('personal in-app notification preferences persist after reload',async({page})=>{
  let preferences={upcoming:true,overdue:true,mentions:true,handoffs:true,approvals:true};await page.route('**/api/notifications',route=>route.fulfill({json:[]}));await page.route('**/api/notifications/preferences**',route=>{if(new URL(route.request().url()).pathname.endsWith('/capabilities'))return route.fulfill({json:{enabled:true}});if(route.request().method()==='PUT'){expect(route.request().postDataJSON()).not.toHaveProperty('userId');preferences=route.request().postDataJSON();}return route.fulfill({json:preferences});});
  await signIn(page);await page.goto('/notifications');await page.getByLabel('Khi được nhắc tên trong bình luận',{exact:true}).uncheck();await page.getByRole('button',{name:'Lưu tùy chọn thông báo',exact:true}).click();await expect(page.getByText('Đã lưu tùy chọn thông báo.',{exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel('Khi được nhắc tên trong bình luận',{exact:true})).not.toBeChecked();
});

test('collaboration panel configures members and approval levels then captures typed values and comments',async({page})=>{
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
  const raw={id:902,title:'Checklist phối hợp',assignee:'Nhân viên thử nghiệm',assigneeId:3,createdById:2,reviewerId:undefined as number|undefined,approvalState:'draft',status:'todo',progress:0,priority:'medium',dueDate:day,checklist:[{id:301,title:'Số đo',completed:false,fieldType:'tick',numberValue:null as number|null,signedById:null as number|null},{id:302,title:'Xác nhận',completed:false,fieldType:'tick',numberValue:null as number|null,signedById:null as number|null}]};
  const data={participants:[] as {userId:number;name:string;available:boolean}[],steps:[] as {position:number;reviewerId:number;reviewerName:string;state:string}[],fields:raw.checklist.map(field=>({...field,lowerBound:null as number|null,upperBound:null as number|null,signedAt:null as string|null})),people:[{id:6,name:'Nhân viên phối hợp'}],mentionPeople:[{id:2,name:'Trưởng khoa thử nghiệm'},{id:3,name:'Nhân viên thử nghiệm'},{id:6,name:'Nhân viên phối hợp'}],canEditMembers:true,canPlan:true,canComment:true,canFill:true};
  let comments:{id:number;authorId:number;authorName:string;body:string;mentions:number[];createdAt:string}[]=[];
  await page.route('**/api/tasks',route=>route.fulfill({json:[raw]}));await page.route('**/api/tasks/902',route=>route.fulfill({json:raw}));await page.route('**/api/work/lookups',route=>route.fulfill({json:{assignees:[{id:3,name:'Nhân viên thử nghiệm'},{id:6,name:'Nhân viên phối hợp'}],reviewers:[{id:5,name:'Trưởng nhóm thử nghiệm'},{id:1,name:'Admin fixture'}]}}));
  await page.route('**/api/work/collaboration/**',async route=>{
    const path=new URL(route.request().url()).pathname,body=route.request().method()==='GET'?{}:route.request().postDataJSON();
    if(path.endsWith('/capabilities'))return route.fulfill({json:{enabled:true}});
    if(path.endsWith('/participants'))data.participants=body.userIds.map((id:number)=>({userId:id,name:'Nhân viên phối hợp',available:true}));
    if(path.endsWith('/approvals')){data.steps=body.reviewerIds.map((id:number,index:number)=>({position:index+1,reviewerId:id,reviewerName:id===5?'Trưởng nhóm thử nghiệm':'Admin fixture',state:'pending'}));raw.reviewerId=body.reviewerIds[0];}
    if(/\/fields\/\d+$/.test(path)){const id=Number(path.split('/').at(-1));const field=data.fields.find(field=>field.id===id)!;field.fieldType=body.type;field.lowerBound=body.min??null;field.upperBound=body.max??null;raw.checklist.find(field=>field.id===id)!.fieldType=body.type;}
    if(path.endsWith('/value')){const id=Number(path.split('/').at(-2));const field=data.fields.find(field=>field.id===id)!;field.completed=true;field.numberValue=body.value??null;field.signedById=body.sign?2:null;field.signedAt=body.sign?new Date().toISOString():null;Object.assign(raw.checklist.find(field=>field.id===id)!,field);raw.progress=raw.checklist.filter(field=>field.completed).length*50;raw.status='doing';data.canPlan=false;}
    if(path.endsWith('/comments')){if(route.request().method()==='POST'){expect(body.mentions).toEqual([6]);comments=[{id:1,authorId:2,authorName:'Trưởng khoa thử nghiệm',body:body.body,mentions:body.mentions,createdAt:new Date().toISOString()}];}return route.fulfill({json:{items:comments,total:comments.length,page:1}});}
    return route.fulfill({json:data});
  });
  await signIn(page);let panel=page.locator('.task-collaboration').first();await panel.locator('summary').first().click();await panel.getByText('Thiết lập người phối hợp',{exact:true}).click();await panel.getByLabel('Nhân viên phối hợp',{exact:true}).check();await panel.getByRole('button',{name:'Lưu người phối hợp',exact:true}).click();await expect(panel.getByRole('listitem').filter({hasText:'Nhân viên phối hợp'})).toBeVisible();
  await panel.getByText('Cấu hình tối đa 5 cấp duyệt',{exact:true}).click();await panel.getByRole('button',{name:'Thêm cấp duyệt',exact:true}).click();await panel.getByLabel('Người duyệt cấp 1',{exact:true}).selectOption('5');await panel.getByRole('button',{name:'Thêm cấp duyệt',exact:true}).click();await panel.getByLabel('Người duyệt cấp 2',{exact:true}).selectOption('1');await panel.getByRole('button',{name:'Lưu lộ trình duyệt',exact:true}).click();await page.getByRole('dialog',{name:'Xác nhận cấu hình phê duyệt'}).getByRole('button',{name:'Xác nhận',exact:true}).click();
  await panel.getByText('Kiểu dữ liệu mục checklist',{exact:true}).click();await panel.getByLabel('Mục cần cấu hình',{exact:true}).selectOption('301');await panel.getByLabel('Kiểu mục checklist',{exact:true}).selectOption('number');await panel.getByLabel('Giới hạn dưới',{exact:true}).fill('2');await panel.getByLabel('Giới hạn trên',{exact:true}).fill('5');await panel.getByRole('button',{name:'Lưu kiểu checklist',exact:true}).click();await panel.getByLabel('Mục cần cấu hình',{exact:true}).selectOption('302');await panel.getByLabel('Kiểu mục checklist',{exact:true}).selectOption('signature');await panel.getByRole('button',{name:'Lưu kiểu checklist',exact:true}).click();
  await panel.getByLabel('Giá trị Số đo',{exact:true}).fill('3.25');await panel.getByRole('button',{name:'Lưu giá trị & hoàn thành mục',exact:true}).click();await expect(page.locator('.task-status-doing')).toBeVisible();panel=page.locator('.task-collaboration').first();if(!await panel.evaluate((node:HTMLDetailsElement)=>node.open))await panel.locator('summary').first().click();await panel.getByLabel('Tôi xác nhận đã thực hiện mục này bằng tài khoản của mình.',{exact:true}).check();await panel.getByRole('button',{name:'Ký xác nhận mục',exact:true}).click();await expect(panel).toContainText('Đã xác nhận bằng tài khoản #2');
  await panel.getByLabel('Nội dung bình luận',{exact:true}).fill('<script>chỉ là văn bản</script>');await panel.getByText('@ Nhắc người tham gia',{exact:true}).click();await panel.getByLabel('@Nhân viên phối hợp',{exact:true}).check();await panel.getByRole('button',{name:'Gửi bình luận',exact:true}).click();await expect(panel.locator('.collaboration-comments')).toContainText('<script>chỉ là văn bản</script>');await expect(panel.locator('.collaboration-comments script')).toHaveCount(0);
});

test('galaxy background animates in depth, can pause and remembers the visual preference', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/work'); await signIn(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const canvas=page.locator('.galaxy-backdrop canvas'); await expect(canvas).toBeVisible();
  const initial=await canvas.evaluate((node:HTMLCanvasElement)=>node.toDataURL());
  await expect.poll(()=>canvas.evaluate((node:HTMLCanvasElement)=>node.toDataURL())).not.toBe(initial);
  const heroCanvas=page.locator('.workspace-galaxy canvas');
  await expect(heroCanvas).toBeVisible();
  await expect(page.locator('.workspace-hero h2')).toHaveCSS('color','rgb(244, 249, 255)');
  await expect(page.locator('.workspace-hero h2 em')).toHaveCSS('color','rgb(135, 231, 255)');
  const contrast=await page.locator('.workspace-hero h2').evaluate(node=>{
    const rgb=getComputedStyle(node).color.match(/[\d.]+/g)!.slice(0,3).map(Number);
    const luminance=(values:number[])=>values.map(value=>{const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
    return (luminance(rgb)+.05)/(luminance([22,58,105])+.05);
  });
  expect(contrast).toBeGreaterThan(4.5);
  await page.locator('.galaxy-control').click(); await expect(page.locator('.galaxy-backdrop')).toHaveClass(/galaxy-still/);
  expect(await heroCanvas.evaluate(async(node:HTMLCanvasElement)=>{const before=node.toDataURL();await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));return before===node.toDataURL();})).toBe(true);
  await page.reload(); await expect(page.locator('.galaxy-backdrop')).toHaveClass(/galaxy-still/);
  await expect(page.getByText('Kiểm tra chờ phê duyệt',{exact:true})).toBeVisible();
  await expect(page.locator('.dashboard-page')).toHaveCSS('opacity','1');
  expect(await page.getByLabel('Lý do nếu từ chối').evaluate(input=>input.getBoundingClientRect().width)).toBeGreaterThan(150);
  await page.screenshot({path:'test-results/galaxy-dashboard-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/galaxy-dashboard-mobile.png',fullPage:true});
  await page.locator('.galaxy-control').click(); await expect(page.locator('.galaxy-backdrop')).toHaveClass(/galaxy-off/);
  await expect(heroCanvas).toBeHidden();
});

test('menu navigation preserves the shell and galaxy yields to interaction', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/work');
  await signIn(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const canvas = page.locator('.galaxy-backdrop canvas');
  await expect(canvas).toBeVisible();
  const originalCanvas = await canvas.elementHandle();
  const documents: string[] = [];
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
  for (const path of ['/tasks', '/archive', '/checklist']) {
    await page.locator(`.sidebar-item[href="${path}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator(`.sidebar-item[href="${path}"]`)).toHaveAttribute('aria-current', 'page');
    expect(await originalCanvas!.evaluate(node => node.isConnected)).toBe(true);
  }
  expect(documents).toEqual([]);
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => node.width * node.height)).toBeLessThanOrEqual(910_000);
  const paused = await canvas.evaluate(async (node: HTMLCanvasElement) => {
    window.dispatchEvent(new Event('scroll'));
    const initial = node.toDataURL();
    await new Promise(resolve => requestAnimationFrame(resolve));
    return initial === node.toDataURL();
  });
  expect(paused).toBe(true);
  const frozen = await canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
  await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL())).not.toBe(frozen);
  // Ring glow is rasterized once; moving frames only blur the pulse and planet rim.
  const work = await page.evaluate(async () => {
    const prototype = CanvasRenderingContext2D.prototype;
    const stroke = prototype.stroke, clear = prototype.clearRect;
    let glowStrokes = 0, frames = 0;
    prototype.stroke = function (path?: Path2D) {
      if (this.shadowBlur > 0) glowStrokes++;
      return Reflect.apply(stroke, this, path ? [path] : []);
    };
    prototype.clearRect = function (...args: Parameters<typeof clear>) {
      frames++; return clear.apply(this, args);
    };
    try { await new Promise(resolve => setTimeout(resolve, 500)); }
    finally { prototype.stroke = stroke; prototype.clearRect = clear; }
    return { glowStrokes, frames };
  });
  expect(work.frames).toBeGreaterThan(0);
  expect(work.glowStrokes / work.frames).toBeLessThanOrEqual(3);
});

test('timer, estimate, returned work and transfer are usable from a task card', async ({page,request})=>{
  await request.get('http://127.0.0.1:3025/__test/edit');
  let task={id:902,title:'Công việc đo giờ',assignee:'Trưởng khoa thử nghiệm',assigneeId:2,createdById:2,status:'doing',progress:0,priority:'medium',dueDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date()),checklist:[]};
  let detail={estimateMinutes:0,totalSeconds:0,activeTimer:null as null|{userId:number;actorName:string;seconds:number},entries:[],returnRequestedBy:null as number|null,returnReason:null as string|null,canManage:true,canStart:true,canReturn:true,canWithdraw:false,canTransfer:true};
  await page.route('**/api/tasks',route=>route.fulfill({json:[task]}));await page.route('**/api/tasks/902',route=>route.fulfill({json:task}));
  await page.route('**/api/work/coordination/**',async route=>{
    const path=new URL(route.request().url()).pathname;const body=route.request().method()==='GET'?{}:route.request().postDataJSON();
    if(path.endsWith('/capabilities'))return route.fulfill({json:{enabled:true}});
    if(path.endsWith('/estimate'))detail.estimateMinutes=body.minutes;
    if(path.endsWith('/start'))detail.activeTimer={userId:2,actorName:'Trưởng khoa thử nghiệm',seconds:2};
    if(path.endsWith('/return'))detail={...detail,activeTimer:null,returnRequestedBy:2,returnReason:body.reason,canStart:false,canReturn:false,canWithdraw:true};
    if(path.endsWith('/resolve-return'))detail={...detail,returnRequestedBy:null,returnReason:null,canStart:true,canReturn:true,canWithdraw:false};
    if(path.endsWith('/transfer')){expect(body.reason).toBe('Đổi người trực xử lý');task={...task,assigneeId:3,assignee:'Nhân viên thử nghiệm'};}
    return route.fulfill({json:detail});
  });
  await signIn(page);const panel=page.locator('.task-coordination').first();await panel.locator('summary').first().click();
  await panel.getByLabel('Ước lượng (phút)').fill('45');await panel.getByRole('button',{name:'Lưu ước lượng',exact:true}).click();await expect(panel).toContainText('Dự kiến 45 phút');
  await panel.getByRole('button',{name:'Bắt đầu đo giờ',exact:true}).click();await expect(panel.getByRole('button',{name:'Dừng đo giờ',exact:true})).toBeVisible();
  await panel.getByRole('textbox',{name:'Lý do điều phối'}).fill('Cần làm rõ yêu cầu');await panel.getByRole('button',{name:'Yêu cầu trả việc',exact:true}).click();await expect(panel).toContainText('Đang yêu cầu trả việc');
  await panel.getByRole('textbox',{name:'Lý do điều phối'}).fill('Đã làm rõ yêu cầu');await panel.getByRole('button',{name:'Rút yêu cầu trả việc',exact:true}).click();await expect(panel.getByRole('button',{name:'Bắt đầu đo giờ',exact:true})).toBeVisible();
  await panel.getByRole('textbox',{name:'Lý do điều phối'}).fill('Đổi người trực xử lý');await panel.getByLabel('Người nhận công việc').selectOption('3');await panel.getByRole('button',{name:'Chuyển việc kèm lý do',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Xác nhận chuyển công việc'});await expect(dialog).toContainText('Nhân viên thử nghiệm');await dialog.getByRole('button',{name:'Xác nhận chuyển việc',exact:true}).click();await expect(dialog).not.toBeVisible();
});

test('handoff requires a recipient confirmation and supports cancelling a proposal',async({page})=>{
  let records=[{id:70,initiatorId:1,receiverId:2,initiatorName:'Admin fixture',receiverName:'Trưởng khoa thử nghiệm',reason:'Tiếp nhận ca mới',state:'pending',taskCount:1,createdAt:new Date().toISOString()}];
  await page.route('**/api/work/coordination/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname,body=route.request().method()==='GET'?{}:route.request().postDataJSON();
    if(path.endsWith('/capabilities'))return route.fulfill({json:{enabled:true}});
    if(path.endsWith('/decision')){const id=Number(path.split('/').at(-2));records=records.map(record=>record.id===id?{...record,state:body.action==='accept'?'accepted':body.action==='cancel'?'cancelled':'rejected'}:record);return route.fulfill({json:{state:'accepted'}});}
    if(/\/handoffs\/\d+$/.test(path))return route.fulfill({json:{items:[{id:902,title:'Việc cần bàn giao',assignee:'Nhân viên thử nghiệm',progress:25}]}});
    if(path.endsWith('/handoffs')&&route.request().method()==='POST'){expect(body.taskIds).toEqual([902]);records=[{...records[0],id:71,initiatorId:2,receiverId:3,initiatorName:'Trưởng khoa thử nghiệm',receiverName:'Nhân viên thử nghiệm',reason:body.reason,state:'pending'},...records];}
    return route.fulfill({json:{items:records,total:records.length,page:1}});
  });
  await page.route('**/api/work/tasks?*',route=>route.fulfill({json:{items:new URL(route.request().url()).searchParams.get('status')==='todo'?[{id:902,title:'Việc cần bàn giao',assigneeId:2,assignee:'Trưởng khoa thử nghiệm',status:'todo',progress:0}]:[],total:1}}));
  await signIn(page);await page.goto('/workflow/handoffs');
  await page.getByRole('button',{name:'Kiểm tra danh sách & xác nhận',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Xử lý bàn giao #70'});await dialog.getByLabel('Lý do xác nhận / từ chối').fill('Đã kiểm tra và nhận việc');await dialog.getByRole('button',{name:'Xác nhận tiếp nhận toàn bộ',exact:true}).click();await expect(page.getByText('Đã tiếp nhận',{exact:true})).toBeVisible();
  await page.getByLabel('Người đang thực hiện',{exact:true}).selectOption('2');await page.getByLabel('Người tiếp nhận',{exact:true}).selectOption('3');await page.getByRole('button',{name:'Tải việc chưa hoàn thành',exact:true}).click();await page.getByRole('checkbox').check();await page.getByLabel('Lý do bàn giao',{exact:true}).fill('Bàn giao đợt tiếp theo');await page.getByRole('button',{name:'Kiểm tra & gửi đề nghị',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Xác nhận gửi bàn giao'});await dialog.getByRole('button',{name:'Gửi đề nghị bàn giao',exact:true}).click();await expect(page.getByText('Chờ tiếp nhận',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Từ chối / hủy đề nghị',exact:true}).click();dialog=page.getByRole('dialog',{name:'Xử lý bàn giao #71'});await dialog.getByLabel('Lý do xác nhận / từ chối').fill('Điều chỉnh danh sách');await dialog.getByRole('button',{name:'Hủy đề nghị bàn giao',exact:true}).click();await expect(page.getByText('Đã hủy',{exact:true})).toBeVisible();
});

test('manager grants and revokes a dated review delegation from the interface',async({page})=>{
  let items:unknown[]=[];
  await page.route('**/api/work/review-delegations**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/capabilities'))return route.fulfill({json:{enabled:true}});
    if(path.endsWith('/revoke'))items=items.map(item=>({...item as object,active:false}));
    else if(route.request().method()==='POST'){const body=route.request().postDataJSON();expect(body.delegateId).toBe(5);items=[{...body,id:1,ownerId:2,delegateId:5,ownerName:'Trưởng khoa thử nghiệm',delegateName:'Trưởng nhóm thử nghiệm',active:true}];}
    return route.fulfill({json:{items,people:[{id:5,name:'Trưởng nhóm thử nghiệm'}]}});
  });
  await signIn(page);await page.goto('/workflow/delegations');await page.getByLabel('Người duyệt thay',{exact:true}).selectOption('5');await page.getByLabel('Lý do ủy quyền',{exact:true}).fill('Đi công tác theo kế hoạch');await page.getByRole('button',{name:'Kiểm tra & lập ủy quyền',exact:true}).click();await page.getByRole('dialog',{name:'Xác nhận ủy quyền duyệt'}).getByRole('button',{name:'Xác nhận lập ủy quyền',exact:true}).click();await expect(page.getByText('Đang hiệu lực',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Thu hồi ủy quyền',exact:true}).click();await expect(page.getByText('Đã thu hồi',{exact:true})).toBeVisible();
});

test('started work with zero progress stays in progress after reloading', async ({ page }) => {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  await page.route('**/api/tasks', route => route.fulfill({json: [{id: 902, title: 'Việc đã bắt đầu 0%', assignee: 'Nhân viên thử nghiệm', assigneeId: 3, createdById: 2, status: 'doing', progress: 0, priority: 'medium', dueDate: day, checklist: []}]}));
  await signIn(page);
  const card = page.locator('.task-card').filter({hasText: 'Việc đã bắt đầu 0%'});
  await expect(card.locator('.task-tag')).toHaveText('ĐANG LÀM');
  await page.reload();
  await expect(card.locator('.task-tag')).toHaveText('ĐANG LÀM');
});

test('manager searches, saves and removes task prerequisites on a small screen', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/work');
  let saved: number[] = [];
  await page.route('**/api/work/dependencies/capabilities', route => route.fulfill({ json: { enabled: true } }));
  await page.route('**/api/work/tasks/901/dependencies', async route => {
    if (route.request().method() === 'PUT') saved = route.request().postDataJSON().dependencyIds;
    await route.fulfill({ json: { items: saved.map(id => ({ id, title: 'Chuẩn bị hồ sơ', completed: false })), blocked: saved.length > 0, canEdit: true } });
  });
  await signIn(page); await page.goto('/workflow');
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  const panel = page.locator('.task-dependencies');
  await panel.locator('summary').click();
  await expect(panel).toContainText('Không có việc tiên quyết.');
  await page.route('**/api/work/tasks?*', route => route.fulfill({ json: { items: [{ id: 800, title: 'Chuẩn bị hồ sơ', status: 'todo', assignee: 'Nhân viên thử nghiệm' }], total: 1, page: 1, limit: 10 } }));
  await panel.getByRole('textbox', { name: 'Tìm việc tiên quyết' }).fill('Chuẩn bị');
  await panel.getByRole('button', { name: 'Tìm', exact: true }).click();
  await panel.getByRole('button', { name: 'Chọn', exact: true }).click();
  await panel.getByRole('button', { name: 'Lưu phụ thuộc', exact: true }).click();
  await expect(panel).toContainText('Đang chờ việc tiên quyết hoàn tất và được duyệt.');
  expect(saved).toEqual([800]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await panel.getByRole('button', { name: 'Bỏ phụ thuộc Chuẩn bị hồ sơ' }).click();
  await panel.getByRole('button', { name: 'Lưu phụ thuộc', exact: true }).click();
  await expect(panel).toContainText('Không có việc tiên quyết.');
  expect(saved).toEqual([]);
});

test('task prerequisites hide unavailable titles and show server conflicts without losing the draft', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/work');
  await page.route('**/api/work/dependencies/capabilities', route => route.fulfill({ json: { enabled: true } }));
  await page.route('**/api/work/tasks/901/dependencies', route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 409, json: { message: 'Liên kết này tạo vòng phụ thuộc công việc' } })
    : route.fulfill({ json: { items: [{ id: 800, title: null, completed: false }], blocked: true, canEdit: true } }));
  await signIn(page); await page.goto('/workflow');
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  const panel = page.locator('.task-dependencies'); await panel.locator('summary').click();
  await expect(panel).toContainText('Công việc ngoài phạm vi xem hiện tại');
  await panel.getByRole('button', { name: 'Bỏ phụ thuộc đã ẩn' }).click();
  await panel.getByRole('button', { name: 'Lưu phụ thuộc', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('vòng phụ thuộc');
  await expect(panel.getByRole('button', { name: 'Hủy thay đổi', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Hủy thay đổi', exact: true }).click();
  await expect(panel).toContainText('Công việc ngoài phạm vi xem hiện tại');
});

test('read-only task dependencies have no editing controls', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/work');
  await request.get('http://127.0.0.1:3025/__test/director');
  await page.route('**/api/work/dependencies/capabilities', route => route.fulfill({ json: { enabled: true } }));
  await page.route('**/api/work/tasks/901/dependencies', route => route.fulfill({ json: { items: [{id: 800, title: 'Việc đã hoàn tất', completed: true}], blocked: false, canEdit: false } }));
  await signIn(page);
  const panel = page.locator('.task-dependencies').first(); await panel.locator('summary').click();
  await expect(panel).toContainText('Đã đủ điều kiện bắt đầu.');
  await expect(panel.getByRole('button')).toHaveCount(0);
});

test('manager configures KPI weights, validates total weight and assigns a position', async ({ page }) => {
  await signIn(page); await page.goto('/kpi/policies');
  await page.getByRole('button', { name: '+ Tạo phiên bản công thức', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Phiên bản công thức KPI mới' });
  await form.getByLabel('Tên công thức', { exact: true }).fill('KPI điều dưỡng thử nghiệm');
  await form.getByLabel('Hoàn thành (%)', { exact: true }).fill('60');
  await expect(form.getByRole('button', { name: 'Lưu phiên bản', exact: true })).toBeDisabled();
  await form.getByLabel('Hoàn thành (%)', { exact: true }).fill('70');
  await form.getByRole('button', { name: 'Lưu phiên bản', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng thông báo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'KPI điều dưỡng thử nghiệm', exact: true })).toBeVisible();
  await page.getByLabel('Vị trí KPI của Nhân viên thử nghiệm', { exact: true }).fill('Điều dưỡng');
  await page.getByRole('button', { name: 'Lưu vị trí', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng thông báo', exact: true }).click();
  await expect(page.getByLabel('Vị trí KPI của Nhân viên thử nghiệm', { exact: true })).toHaveValue('Điều dưỡng');
  await page.screenshot({ path: 'test-results/kpi-policies-desktop.png', fullPage: true });
});

test('admin inspects saved KPI history and closes an ended period', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/admin'); await signIn(page); await page.goto('/kpi');
  await page.getByRole('button', { name: 'Nhân viên thử nghiệm', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Lịch sử KPI · Nhân viên thử nghiệm' });
  await expect(history).toContainText('82.5 điểm'); await expect(history).toContainText('Công thức kỳ trước');
  await history.getByRole('button', { name: 'Đóng cửa sổ' }).click();
  await page.getByLabel('Mốc ngày', { exact: true }).fill('2026-10-01');
  await page.getByRole('button', { name: 'Chốt kỳ KPI', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận chốt kỳ', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng thông báo', exact: true }).click();
  await expect(page.getByText('Đã chốt', { exact: true })).toBeVisible();
});

test('read-only director can view KPI without configuration or write controls', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/director'); await signIn(page); await page.goto('/kpi');
  await expect(page.getByRole('heading', { name: 'Xếp hạng KPI', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Công thức & chỉ tiêu' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chốt kỳ KPI', exact: true })).toHaveCount(0);
  await page.goto('/kpi/policies'); await expect(page).toHaveURL(/\/checklist$/);
});

test('completing and reopening work never rewrites its recurrence setting', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/edit'); await signIn(page);
  const checkbox = page.getByRole('checkbox', { name: 'Đánh dấu hoàn thành: Công việc cập nhật tiến độ', exact: true });
  for (const status of ['done', 'todo']) {
    const pending = page.waitForResponse(response => response.url().endsWith('/api/tasks/902') && response.request().method() === 'PATCH');
    await checkbox.click(); const response = await pending;
    expect(response.request().postDataJSON()).not.toHaveProperty('isRecurring');
    expect((await response.json()).isRecurring).toBe(true);
    await page.getByRole('button', { name: 'Đóng thông báo', exact: true }).click();
    if (status === 'done') await expect(checkbox).toBeChecked(); else await expect(checkbox).not.toBeChecked();
  }
});

test('reviewer approves a locked submission and the work journal records the action', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/work');
  await signIn(page); await page.goto('/workflow');
  await expect(page.getByRole('button', { name: 'Chi tiết', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/work-approvals-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  await expect(page.getByText('Chờ duyệt · Đã khóa chỉnh sửa', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Duyệt hoàn thành', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng thông báo', exact: true }).click();
  await expect(page.getByText('Đã duyệt · Checklist đã khóa', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('tab', { name: 'Nhật ký', exact: true }).click();
  await expect(page.getByText('approve', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/work-audit-mobile.png', fullPage: true });
});

test('recurring template saves a versioned monthly schedule from the user interface', async ({ page }) => {
  await signIn(page); await page.goto('/workflow');
  await page.getByRole('tab', { name: 'Mẫu định kỳ', exact: true }).click();
  await page.getByRole('button', { name: '+ Tạo mẫu lặp lại', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Mẫu công việc định kỳ' });
  await form.getByLabel('Tên mẫu').fill('Checklist định kỳ thử nghiệm');
  await form.getByLabel('Người thực hiện').selectOption('3'); await form.getByLabel('Người duyệt').selectOption('2');
  await form.getByLabel('Chu kỳ').selectOption('monthly'); await form.getByLabel('Các bước checklist').fill('Kiểm tra\nXác nhận');
  await form.getByRole('button', { name: 'Lưu mẫu', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng thông báo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Checklist định kỳ thử nghiệm', exact: true })).toBeVisible();
  await expect(page.getByText('Phiên bản 1', { exact: true })).toBeVisible();
});

test('admin exports a genuine xlsx with logo and the PDF print layout has signature spaces', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/admin'); await signIn(page); await page.goto('/reports');
  const button = page.getByRole('button', { name: 'Xuất Excel (.xlsx)', exact: true }); await expect(button).toBeEnabled();
  const pending = page.waitForEvent('download'); await button.click(); const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/); await download.saveAs('test-results/work-report.xlsx');
  await page.emulateMedia({ media: 'print' }); await expect(page.locator('.report-print-header')).toBeVisible(); await expect(page.locator('.report-signatures')).toBeVisible();
  await page.pdf({ path: 'test-results/work-report.pdf', format: 'A4', printBackground: true });
});

test('changing report department uses the server scope and never reuses the previous period data', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/admin'); await signIn(page); await page.goto('/reports');
  const completed = page.locator('.metric-card').filter({ hasText: 'Đã hoàn thành' }).locator('.stat-value');
  await expect(completed).toHaveText('1');
  await page.route('**/api/reports?*', async route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('scope')).toBe('department'); expect(url.searchParams.get('scopeId')).toBe('10');
    await route.fulfill({ json: { data: { tasks: [], totalTasks: 0, completedTasks: 0, lateTasks: 0, avgScore: 0, chartData: [], categories: [], highlights: [] } } });
  });
  const scoped = page.waitForResponse(response => response.url().includes('/api/reports?') && new URL(response.url()).searchParams.get('scopeId') === '10');
  await page.getByRole('combobox', { name: 'Khoa/phòng báo cáo' }).selectOption('10'); await scoped;
  await expect(page.getByText('Đang tổng hợp báo cáo…', { exact: true })).toBeHidden();
  await expect(completed).toHaveText('0');
  await page.screenshot({ path: 'test-results/work-reports.png', fullPage: true });
});

test('remembered personal device restores access after browser session cookies disappear', async ({ page, context }) => {
  await signIn(page, true);
  const cookie = (await context.cookies()).find(value => value.name === 'careops_device');
  expect(cookie?.httpOnly).toBe(true); expect(cookie?.secure).toBe(true);
  expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 29 * 86400);
  expect(await page.evaluate(() => document.cookie.includes('careops_device'))).toBe(false);
  await page.close();
  await context.clearCookies({ name: 'careops_session' }); await context.clearCookies({ name: 'careops_refresh' });
  page = await context.newPage();
  await page.goto('/checklist'); await expect(page.locator('.sidebar-usercard')).toBeVisible();
  await expect(page).toHaveURL(/\/checklist$/);
});

test('explicit logout keeps device trust but requires password and CAPTCHA without another OTP', async ({ page }) => {
  let otpVerifications = 0; page.on('request', request => { if (request.url().endsWith('/api/auth/verify-login-otp')) otpVerifications++; });
  await signIn(page, true);
  await page.locator('.user-chip').click();
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(page.locator('input[type=email]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quên thiết bị này', exact: true })).toBeVisible();
  await page.locator('input[type=email]').fill('manager@example.invalid');
  await page.locator('.password-field input').fill('OnlyAFixturePassword-42');
  await expect(page.locator('.captcha-preview img')).toBeVisible(); await page.locator('#login-captcha').fill('222222');
  await expect(page.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(page).toHaveURL(/\/checklist$/); expect(otpVerifications).toBe(1);
});

test('forgetting the device removes persistent trust and requires OTP again', async ({ page, context }) => {
  await signIn(page, true); await page.goto('/account');
  await page.getByRole('button', { name: 'Quên thiết bị này và đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await context.cookies()).some(value => value.name === 'careops_device')).toBe(false);
  await openOtp(page);
});

test('idle lock stays locked until the remembered-device continue button is pressed', async ({ page }) => {
  await signIn(page, true);
  await page.evaluate(() => localStorage.setItem('careops-last-activity', String(Date.now() - 31 * 60000)));
  await expect(page).toHaveURL(/\/login\?reason=idle/);
  await page.getByRole('button', { name: 'Tiếp tục trên thiết bị này', exact: true }).click();
  await expect(page).toHaveURL(/\/checklist$/); await expect(page.locator('.sidebar-usercard')).toBeVisible();
});

test('OTP moves focus, supports Backspace and pasting all six digits on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openOtp(page);
  const cells = page.locator('.otp-digit');
  await cells.nth(0).press('1');
  await expect(cells.nth(1)).toBeFocused();
  await cells.nth(1).press('Backspace');
  await expect(cells.nth(0)).toBeFocused();
  await expect(cells.nth(0)).toHaveValue('');
  await cells.nth(0).evaluate(element => {
    const clipboardData = new DataTransfer(); clipboardData.setData('text', '123456');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  });
  for (let index = 0; index < 6; index++) await expect(cells.nth(index)).toHaveValue(String(index + 1));
  await expect(page.locator('.auth-primary')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/otp-mobile.png', fullPage: true });
});

test('HTTPS headers, nonce and strict Origin survive the gateway', async ({ request }) => {
  const first = await request.get('/login'); const second = await request.get('/login');
  expect(first.headers()['strict-transport-security']).toBe('max-age=31536000');
  const csp = first.headers()['content-security-policy'];
  expect(csp).not.toContain('unsafe-eval'); expect(csp).not.toBe(second.headers()['content-security-policy']);
  expect(await first.text()).toContain(csp.match(/nonce-([^']+)/)![1]);
  expect((await request.post('/api/auth/login', { data: {} })).status()).toBe(403);
  expect((await request.post('/api/auth/login', { headers: { Origin: 'https://evil.example.invalid' }, data: {} })).status()).toBe(403);
});
test('OTP session is HttpOnly, survives reload and respects manager permissions', async ({ page, context }) => {
  await signIn(page);
  const cookie = (await context.cookies()).find(cookie => cookie.name === 'careops_session');
  expect(cookie?.httpOnly).toBe(true); expect(cookie?.secure).toBe(true); expect(cookie?.sameSite).toBe('Lax');
  expect(await page.evaluate(() => document.cookie.includes('careops_session'))).toBe(false);
  expect(await page.evaluate(() => !!localStorage.getItem('accessToken') || !!localStorage.getItem('refreshToken'))).toBe(false);
  await expect(page.locator('a[href="/reports"]')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.sidebar-usercard')).toBeVisible(); await expect(page).toHaveURL(/\/checklist$/);
});

test('reload restores an expired access cookie using the HttpOnly refresh cookie', async ({ page, context }) => {
  await signIn(page);
  const before = (await context.cookies()).find(cookie => cookie.name === 'careops_refresh');
  expect(before?.httpOnly).toBe(true); expect(before?.secure).toBe(true);
  await context.clearCookies({ name: 'careops_session' });
  await page.reload(); await expect(page.locator('.sidebar-usercard')).toBeVisible(); await expect(page).toHaveURL(/\/checklist$/);
  const after = (await context.cookies()).find(cookie => cookie.name === 'careops_refresh');
  expect(after?.value).not.toBe(before?.value);
  expect(await page.evaluate(() => document.cookie.includes('careops_refresh'))).toBe(false);
});

test('activity renews without exposing tokens to browser JavaScript', async ({ page }) => {
  await signIn(page);
  const renewed = page.waitForResponse(response => response.url().endsWith('/api/auth/refresh'));
  await page.evaluate(() => { localStorage.setItem('careops-last-activity', String(Date.now() - 30000)); localStorage.setItem('careops-last-renewal', String(Date.now() - 90000)); });
  const response = await renewed; expect(response.status()).toBe(200);
  const data = await response.json(); expect(data.user.id).toBe(2); expect(data.accessToken).toBeUndefined(); expect(data.refreshToken).toBeUndefined();
});

test('idle warning allows continuation and 30 idle minutes sign out', async ({ page }) => {
  await signIn(page);
  await page.evaluate(() => { localStorage.setItem('careops-last-activity', String(Date.now() - 29 * 60000 - 10000)); localStorage.setItem('careops-last-renewal', String(Date.now())); });
  await expect(page.locator('.session-idle-notice')).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục làm việc', exact: true }).click();
  await expect(page.locator('.session-idle-notice')).toBeHidden();
  await page.evaluate(() => { localStorage.setItem('careops-last-activity', String(Date.now() - 31 * 60000)); });
  await expect(page).toHaveURL(/\/login/);
});
test('429 blocks submission and countdown survives reload', async ({ page }) => {
  await page.goto('/login'); await page.locator('input[type=email]').fill('rate@example.invalid'); await page.locator('.password-field input').fill('OnlyAFixturePassword-42');
  await expect(page.locator('.captcha-preview img')).toBeVisible(); await page.locator('#login-captcha').fill('222222');
  await page.locator('.auth-primary').click(); await expect(page.locator('.auth-alert[role=status]')).toContainText('giây'); await expect(page.locator('.auth-primary')).toBeDisabled();
  await page.reload(); await expect(page.locator('.auth-alert[role=status]')).toContainText('giây');
  await expect(page.locator('.captcha-preview img')).toBeVisible(); await page.locator('#login-captcha').fill('222222');
  await expect(page.locator('.auth-primary')).toBeEnabled({ timeout: 10000 });
});

test('incorrect CAPTCHA stays on login and refreshes the image', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type=email]').fill('manager@example.invalid');
  await page.locator('.password-field input').fill('OnlyAFixturePassword-42');
  await expect(page.locator('.captcha-preview img')).toBeVisible();
  await page.locator('#login-captcha').fill('AAAAAA');
  await page.locator('.auth-primary').click();
  await expect(page.locator('.auth-alert-error')).toContainText('CAPTCHA');
  await expect(page.locator('#login-captcha')).toHaveValue('');
  await expect(page.locator('.captcha-preview img')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
test('403 keeps the session; a subsequent 401 signs out', async ({ page, request, context }) => {
  await signIn(page); await request.get('http://127.0.0.1:3025/__test/forbidden'); await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'không có quyền' })).toBeVisible(); await expect(page).toHaveURL(/\/checklist$/);
  expect((await context.cookies()).some(cookie => cookie.name === 'careops_session')).toBe(true);
  await request.get('http://127.0.0.1:3025/__test/expire'); await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await expect(page).toHaveURL(/\/login/);
  expect((await context.cookies()).some(cookie => cookie.name === 'careops_session')).toBe(false);
});
test('Ant Design and dashboard run without CSP violations', async ({ page }) => {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.cspViolations?.push(event.effectiveDirective));
  });
  await signIn(page); await page.goto('/employees'); await expect(page.getByRole('heading', { name: 'Quản lý nhân viên' })).toBeVisible();
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
});
