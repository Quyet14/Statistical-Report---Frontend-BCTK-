import { test, expect, type Page } from '@playwright/test';
declare global { interface Window { cspViolations?: string[] } }

async function openOtp(page: Page, remember = false) {
  await page.goto('/login');
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
