/**
 * Probes Dapic finance endpoints without printing secrets.
 * Outputs counts, field names, detected status/type values and redacted samples.
 */
const fs = require('fs');
const https = require('https');

const credentials = fs.readFileSync('squads/n8n-erp-dashboard/_memory/credentials.md', 'utf8');
const empresa = credentials.match(/\*\*Empresa\*\*\s*\|\s*`([^`]+)`/)?.[1]
  || credentials.match(/Empresa[^`]*`([^`]+)`/)?.[1];
const tokenIntegracao = credentials.match(/\*\*TokenIntegracao\*\*\s*\|\s*`([^`]+)`/)?.[1]
  || credentials.match(/TokenIntegracao[^`]*`([^`]+)`/)?.[1];

if (!empresa || !tokenIntegracao) {
  throw new Error('Empresa/TokenIntegracao nao encontrados em credentials.md');
}

const BASE = 'https://api.dapic.com.br';

function post(path, body) {
  return request('POST', path, body);
}

function get(path, qs = {}) {
  const query = new URLSearchParams(qs).toString();
  return request('GET', query ? `${path}?${query}` : path);
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      BASE + path,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
          ...(global.accessToken ? { Authorization: `Bearer ${global.accessToken}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function redactRecord(record) {
  const out = {};
  for (const [key, value] of Object.entries(record || {})) {
    if (/token|senha|password|documento|cpf|cnpj|email|telefone/i.test(key)) continue;
    if (typeof value === 'string' && value.length > 120) out[key] = value.slice(0, 120) + '...';
    else out[key] = value;
  }
  return out;
}

function summarize(label, response) {
  const arr = Array.isArray(response.body?.Dados) ? response.body.Dados : [];
  const keys = [...new Set(arr.flatMap(item => Object.keys(item || {})))].sort();
  const statuses = [...new Set(arr.map(item => item.Status ?? item.status ?? item.Situacao ?? item.situacao).filter(v => v != null).map(String))].sort();
  const tipos = [...new Set(arr.map(item => item.Tipo ?? item.tipo ?? item.TipoLancamento ?? item.Natureza ?? item.PagarReceber).filter(v => v != null).map(String))].sort();
  const valorKeys = keys.filter(k => /valor|total|saldo|pago|receb/i.test(k));
  const dateKeys = keys.filter(k => /data|venc|pag|baix|quit|liq|receb/i.test(k));
  console.log(`\n## ${label}`);
  console.log(JSON.stringify({
    status: response.status,
    count: arr.length,
    totalPaginas: response.body?.TotalPaginas ?? null,
    keys,
    statuses,
    tipos,
    valorKeys,
    dateKeys,
    sample: arr.slice(0, 3).map(redactRecord),
  }, null, 2));
}

(async () => {
  const auth = await post('/autenticacao/v1/login', { Empresa: empresa, TokenIntegracao: tokenIntegracao });
  global.accessToken = auth.body?.access_token;
  if (!global.accessToken) throw new Error(`Auth Dapic falhou: ${auth.status}`);

  const today = new Date();
  const ranges = [
    ['D-1 vencimento', iso(addDays(today, -1)), iso(addDays(today, -1))],
    ['90d atras a 30d frente', iso(addDays(today, -90)), iso(addDays(today, 30))],
    ['hoje a 30d frente', iso(today), iso(addDays(today, 30))],
  ];

  for (const [name, start, end] of ranges) {
    for (const filtrarPor of [0, 1, 2]) {
      const res = await get('/v1/contas/parcelas', {
        DataInicial: start,
        DataFinal: end,
        FiltrarPor: filtrarPor,
        Pagina: 1,
        RegistrosPorPagina: 50,
      });
      summarize(`parcelas | ${name} | FiltrarPor=${filtrarPor}`, res);
    }
  }

  for (const [name, start, end] of ranges) {
    const res = await get('/v1/contas/pagamentos', {
      DataInicial: start,
      DataFinal: end,
      Pagina: 1,
      RegistrosPorPagina: 50,
    });
    summarize(`pagamentos | ${name}`, res);
  }
})().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
