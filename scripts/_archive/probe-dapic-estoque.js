/**
 * Probe dos endpoints de estoque da Dapic — descobre quais respondem 200
 * e quais campos retornam. Nao imprime segredos.
 */
const fs = require('fs');
const https = require('https');

const credentials = fs.readFileSync('squads/n8n-erp-dashboard/_memory/credentials.md', 'utf8');
const empresa = credentials.match(/\*\*Empresa \(Identificador\)\*\*\s*\|\s*`([^`]+)`/)?.[1]
  || credentials.match(/Empresa[^`]*`([^`]+)`/)?.[1];
const tokenIntegracao = credentials.match(/\*\*TokenIntegracao\*\*\s*\|\s*`([^`]+)`/)?.[1]
  || credentials.match(/TokenIntegracao[^`]*`([^`]+)`/)?.[1];

if (!empresa || !tokenIntegracao) throw new Error('Credenciais nao encontradas');

const BASE = 'https://api.dapic.com.br';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(BASE + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(global.accessToken ? { Authorization: `Bearer ${global.accessToken}` } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function get(path, qs = {}) {
  const query = new URLSearchParams(qs).toString();
  return request('GET', query ? `${path}?${query}` : path);
}

function summarize(label, res) {
  const arr = Array.isArray(res.body?.Dados) ? res.body.Dados
    : Array.isArray(res.body) ? res.body : [];
  const keys = [...new Set(arr.flatMap(i => Object.keys(i || {})))].sort();
  console.log(`\n## ${label}`);
  console.log(JSON.stringify({
    status: res.status,
    count: arr.length,
    totalPaginas: res.body?.TotalPaginas ?? null,
    keys,
    sample: arr.slice(0, 2),
    errorBody: arr.length ? undefined : (typeof res.body === 'string' ? res.body.slice(0, 200) : res.body),
  }, null, 2));
}

(async () => {
  const auth = await request('POST', '/autenticacao/v1/login', { Empresa: empresa, TokenIntegracao: tokenIntegracao });
  global.accessToken = auth.body?.access_token;
  if (!global.accessToken) throw new Error(`Auth falhou: ${auth.status}`);
  console.log('Auth OK');

  // 1. Listar armazenadores (para pegar um IdArmazenador valido)
  const armazenadores = await get('/v1/estoques', { Pagina: 1, RegistrosPorPagina: 50 });
  summarize('GET /v1/estoques (armazenadores)', armazenadores);

  const primeiroArmazenador = (armazenadores.body?.Dados || [])[0];
  const idArmazenador = primeiroArmazenador?.Id || primeiroArmazenador?.IdArmazenador;

  // 2. Endpoints candidatos de saldo consolidado
  const candidatos = [
    ['/v1/estoques/todos', {}],
    ['/v1/estoques/todos', { Pagina: 1, RegistrosPorPagina: 50 }],
    ['/v1/armazenadores/produtos', { Pagina: 1, RegistrosPorPagina: 50 }],
    ['/v1/armazenadores/produtos', { SaldoZerado: true, Pagina: 1, RegistrosPorPagina: 50 }],
  ];
  for (const [path, qs] of candidatos) {
    try { summarize(`GET ${path} ${JSON.stringify(qs)}`, await get(path, qs)); }
    catch (e) { console.log(`\n## ${path} ERRO`, e.message); }
  }

  // 3. Produtos de um armazenador especifico
  if (idArmazenador) {
    try {
      summarize(`GET /v1/estoques/${idArmazenador}/produtos`, await get(`/v1/estoques/${idArmazenador}/produtos`, { Pagina: 1, RegistrosPorPagina: 50 }));
    } catch (e) { console.log('erro estoques/{id}/produtos', e.message); }
  }
})().catch(e => { console.error(e.message || e); process.exit(1); });
