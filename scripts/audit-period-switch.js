const { chromium } = require('playwright');

const daily = Array.from({ length: 90 }, (_, index) => {
  const date = new Date('2026-05-26T12:00:00Z');
  date.setDate(date.getDate() - (89 - index));
  return {
    data: date.toISOString().slice(0, 10),
    receita: index + 1,
    volume: 1,
  };
});

const responses = {
  resumo: {
    atualizadoEm: '2026-05-26T11:00:00Z',
    receita_total: daily.reduce((sum, item) => sum + item.receita, 0),
    volume_vendas: 90,
    saldo_liquido: 500,
    total_inadimplente: 25,
    total_pendente_cr: 1000,
  },
  vendas: {
    dados: {
      summary: { receita_total: 4095, volume_vendas: 90, ticket_medio: 45.5 },
      evolucao_diaria: daily,
      top_produtos: [],
      top_clientes: [],
    },
  },
  estoque: {
    dados: {
      summary: { skus_criticos: 0, skus_alerta: 0, total_skus: 0 },
      saldo_dia: [],
      reposicao_urgente: [],
    },
  },
  'contas-receber': { dados: { recebendo_7d: [], summary: { saldo_liquido: 500 } } },
  'contas-pagar': { dados: { summary: {} } },
  'fluxo-caixa': { dados: { projecao_4_semanas: [] } },
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.route('https://workflows.tmrodrigues.tech/webhook/erp**', async route => {
    const url = new URL(route.request().url());
    const modulo = url.searchParams.get('modulo');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responses[modulo] || { dados: {} }),
    });
  });

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    sessionStorage.setItem('auth_token', 'audit-token');
    sessionStorage.setItem('user_info', JSON.stringify({ email: 'audit@local.test' }));
  });
  await page.goto('http://127.0.0.1:5173/visao-geral', { waitUntil: 'domcontentloaded' });
  await page.getByText('Receita do Período').waitFor();

  async function readRevenue() {
    const body = await page.locator('body').innerText();
    const match = body.match(/Receita do Período\s+([^\n]+)/);
    return match ? match[1] : body.slice(0, 300);
  }

  const value30 = await readRevenue();
  await page.getByRole('button', { name: '7d' }).click();
  await page.waitForTimeout(100);
  const value7 = await readRevenue();
  await page.getByRole('button', { name: '90d' }).click();
  await page.waitForTimeout(100);
  const value90 = await readRevenue();

  await browser.close();

  const result = { value7, value30, value90, pageErrors };
  console.log(JSON.stringify(result, null, 2));

  if (pageErrors.length) throw new Error(pageErrors.join(' | '));
  if (value7 === value30 || value30 === value90 || value7 === value90) {
    throw new Error('Period switching did not change revenue values');
  }
})();
