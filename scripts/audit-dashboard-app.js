const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(() => {
    sessionStorage.setItem('auth_token', 'audit-token');
    sessionStorage.setItem('user_info', JSON.stringify({ email: 'audit@local.test', name: 'Audit' }));
  });
  await page.goto('http://127.0.0.1:5173/visao-geral', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  const result = {
    url: page.url(),
    title: await page.title(),
    bodyText: (await page.locator('body').innerText()).slice(0, 1200),
    hasRootContent: await page.locator('#root').evaluate((node) => node.textContent.trim().length > 0),
    consoleErrors,
    pageErrors,
  };

  await page.screenshot({ path: 'dashboard-audit.png', fullPage: true });
  await browser.close();

  console.log(JSON.stringify(result, null, 2));

  if (!result.hasRootContent) throw new Error('React root rendered empty content');
  if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
})();
