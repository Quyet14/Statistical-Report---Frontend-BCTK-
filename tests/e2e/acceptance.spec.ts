import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/login');
  await expect(page.locator('.captcha-preview img')).toBeVisible();
  await page.locator('input[type=email]').fill('manager@example.invalid');
  await page.locator('.password-field input').fill('OnlyAFixturePassword-42');
  await page.locator('#login-captcha').fill('222222');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.locator('input[autocomplete=one-time-code]').fill('123456');
  await page.getByRole('button', { name: 'Xác nhận và đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/checklist$/);
  await expect(page.locator('.sidebar-usercard')).toBeVisible();
}

test.beforeEach(async ({ request }) => { await request.get('http://127.0.0.1:3025/__test/reset'); });

test('desktop mouse drag shows refresh loading and reloads once after release', async ({ page }) => {
  await signIn(page);
  const area = await page.locator('.dashboard-main').boundingBox();
  expect(area).not.toBeNull();
  const x = area!.x + 5, y = area!.y + 110;
  let reloads = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document' && request.frame() === page.mainFrame()) reloads++; });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 190, { steps: 10 });
  await expect(page.locator('.pull-refresh-indicator')).toContainText('Thả để tải lại');
  await expect(page.locator('.pull-refresh-indicator')).toBeVisible();
  const loaded = page.waitForEvent('domcontentloaded');
  await page.mouse.up();
  await loaded;
  await expect(page.locator('.user-chip')).toContainText('Trưởng khoa thử nghiệm');
  expect(reloads).toBe(1);
});

test('pull refresh cancels short and scrolled gestures, reloads at the top and protects edited forms', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 650 });
  const gesture = async (phase: 'pull' | 'end', dy = 180) => page.locator('.dashboard-content').evaluate((target, options) => {
    const touch = (y: number) => new Touch({ identifier: 1, target, clientX: 100, clientY: y });
    if (options.phase === 'pull') {
      target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch(100)] }));
      target.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touch(100 + options.dy)] }));
    } else target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [touch(100 + options.dy)] }));
  }, { phase, dy });
  let navigations = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document' && request.frame() === page.mainFrame()) navigations++; });
  await gesture('pull', 30);
  await gesture('end', 30);
  await expect(page.locator('.pull-refresh-indicator')).not.toBeVisible();
  await page.waitForTimeout(250);
  expect(navigations).toBe(0);
  const scrolled = await page.locator('.dashboard-main').evaluate(element => { element.scrollTop = 80; return element.scrollTop; });
  expect(scrolled).toBeGreaterThan(0);
  await gesture('pull'); await gesture('end');
  await expect(page.locator('.pull-refresh-indicator')).not.toBeVisible();
  await page.locator('.dashboard-main').evaluate(element => { element.scrollTop = 0; });
  await gesture('pull');
  await expect(page.getByRole('status').filter({ hasText: 'Thả để tải lại' })).toBeVisible();
  const loaded = page.waitForEvent('domcontentloaded');
  await gesture('end');
  await loaded;
  await expect(page.locator('.user-chip')).toContainText('Trưởng khoa thử nghiệm');
  expect(navigations).toBe(1);
  await page.locator('.dashboard-content').evaluate(element => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    form.append(input); element.append(form);
    input.value = 'Nội dung đang soạn';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  let prompted = false;
  page.once('dialog', async dialog => { prompted = true; await dialog.dismiss(); });
  await gesture('pull'); await gesture('end');
  await expect.poll(() => prompted).toBe(true);
  await page.waitForTimeout(250);
  expect(navigations).toBe(1);
});

test('assignment keeps its submit action visible on short screens and submits without an English title', async ({ page }) => {
  const submitted: Record<string, unknown>[] = [];
  await page.route('**/api/tasks', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const payload = route.request().postDataJSON();
    submitted.push(payload);
    await route.fulfill({ json: { ...payload, id: 900 + submitted.length, departmentId: 10, checklist: [] } });
  });
  await signIn(page);
  for (const viewport of [{ width: 1280, height: 600 }, { width: 390, height: 650 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/checklist');
    await page.locator('.topbar-actions').getByRole('button', { name: 'Giao việc', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Giao việc mới', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[name="titleEn"]')).toHaveCount(0);
    const submit = dialog.getByRole('button', { name: 'Giao việc', exact: true });
    await expect(submit).toBeInViewport({ ratio: 1 });
    await dialog.locator('input[name="title"]').fill('Công việc kiểm thử giao diện');
    await dialog.locator('select[name="assigneeId"]').selectOption('3');
    await dialog.locator('input[name="time"]').fill('2026-11-12');
    await dialog.locator('.task-form-fields').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(submit).toBeInViewport({ ratio: 1 });
    await expect(dialog.locator('.task-modal-header')).toBeInViewport({ ratio: 1 });
    if (viewport.width === 390) await page.screenshot({ path: 'test-results/qa-assignment-mobile.png' });
    await submit.click();
    await expect(dialog).not.toBeVisible();
  }
  expect(submitted).toHaveLength(2);
  for (const payload of submitted) {
    expect(payload.title).toBe('Công việc kiểm thử giao diện');
    expect(payload.assigneeId).toBe(3);
    expect(payload).not.toHaveProperty('titleEn');
  }
});

test('hospital operations restores all three workflows and sends a department request on mobile', async ({ page }) => {
  const records: Record<string, unknown>[] = [];
  await page.route('**/api/hospital-operations/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/capabilities')) return route.fulfill({ json: { enabled: true } });
    if (url.pathname.endsWith('/departments')) return route.fulfill({ json: [{ id: 10, name: 'Khoa A' }, { id: 20, name: 'Khoa B' }] });
    if (url.pathname.endsWith('/recipients')) return route.fulfill({ json: [{ id: 4, name: 'Người nhận QA', role: 'staff', departmentId: 20 }] });
    if (url.pathname.endsWith('/requests') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      expect(body.targetDepartmentId).toBe(20); expect(body.assigneeId).toBe(4);
      expect(body).not.toHaveProperty('sourceDepartmentId');
      records.push({ ...body, id: 1, requesterId: 2, requesterName: 'Manager fixture', sourceDepartmentId: 10, sourceDepartmentName: 'Khoa A', targetDepartmentName: 'Khoa B', assigneeName: 'Người nhận QA', status: 'pending' });
      return route.fulfill({ json: { id: 1 } });
    }
    return route.fulfill({ json: { items: url.pathname.endsWith('/requests') ? records : [], total: records.length, page: 1, limit: 25 } });
  });
  await signIn(page); await page.goto('/hospital-operations');
  await expect(page.getByRole('heading', { name: 'Điều phối & an toàn vận hành' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(3);
  await page.getByRole('tab', { name: 'Sự cố checklist', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Báo sự cố từ checklist' })).toBeVisible();
  await page.getByRole('tab', { name: 'Thiết bị & kiểm tra', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thêm thiết bị / tài sản' })).toBeVisible();
  await page.getByRole('tab', { name: 'Yêu cầu liên khoa', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const form = page.locator('.hospital-form').first();
  await form.getByRole('combobox', { name: 'Khoa/phòng nhận', exact: true }).selectOption('20');
  await form.getByRole('combobox', { name: 'Người nhận', exact: true }).selectOption('4');
  await form.getByLabel('Nội dung', { exact: true }).fill('Yêu cầu hỗ trợ QA');
  await form.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
  await expect(page.getByText('Đã gửi yêu cầu liên khoa', { exact: true })).toBeVisible();
  await expect(form.getByLabel('Nội dung', { exact: true })).toHaveValue('');
  expect(records).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/qa-hospital-mobile.png', fullPage: true });
});

test('staff navigation has no management controls and rejects an administration page', async ({ page, request }) => {
  await request.get('http://127.0.0.1:3025/__test/staff-role');
  await signIn(page);
  await expect(page.locator('.sidebar-item[href="/employees"]')).toHaveCount(0);
  await expect(page.locator('.sidebar-item[href="/settings/operations"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Giao việc', exact: true })).toHaveCount(0);
  await page.goto('/settings/operations'); await expect(page).toHaveURL(/\/checklist$/);
  await expect(page.locator('.sidebar-usercard')).toBeVisible();
});

test('language can switch to English, survive reload and switch back to Vietnamese', async ({ page }) => {
  await page.route('**/api/i18n/en**', route => route.fulfill({ json: { translations: {}, total: 0, offset: 0, limit: 40 } }));
  await signIn(page);
  const language = page.locator('.locale-switcher select').first();
  await language.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.sidebar-item[href="/checklist"]')).toContainText("Today's work");
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('.locale-switcher select').first().selectOption('vi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('.sidebar-item[href="/checklist"]')).toContainText('Việc hôm nay');
});
