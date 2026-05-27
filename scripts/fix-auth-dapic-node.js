/**
 * Corrige o nó Autenticar Dapic no workflow ativo (mesmo padrão dos workflows que funcionam).
 * - Remove sendHeaders + Content-Type (quebra bodyParameters no n8n)
 * - Injeta credenciais literais (como K7nwMM7I2Wy2Q1HC e workflow-audit)
 */
const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const API_KEY = config.mcpServers?.['n8n-mcp']?.env?.N8N_API_KEY;
const HOST = 'workflows.tmrodrigues.tech';
const WF_ID = process.argv[2] || '5vEtPrd4vzjCBK9w';

// Credenciais do workflow "Relatório Diário — RM Franca" (funciona no n8n)
const EMPRESA = 'techmalhasfranca';
const TOKEN = 'kymSrgZ237FFt73ri4hdqqa5zjWbU3';

const PREPARAR_CONTEXTO_CODE = `const auth = $('🔐 Autenticar Dapic').first().json;
const periodo = $('Definir Periodo (D-1)').first().json;
const token = auth.access_token || auth.token || (auth.data && auth.data.access_token) || '';
if (!token) {
  throw new Error('Falha na autenticacao Dapic: access_token nao retornado. Resposta: ' + JSON.stringify(auth).slice(0, 300));
}
return [{
  json: {
    token,
    dataHoje: periodo.dataHoje,
    dataColeta: periodo.dataColeta,
    janelaColeta: periodo.janelaColeta || 'D-1',
    baseUrl: 'https://api.dapic.com.br',
    iniciadoEm: new Date().toISOString()
  }
}];`;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: HOST,
        path: `/api/v1${path}`,
        method,
        headers: {
          'X-N8N-API-KEY': API_KEY,
          Accept: 'application/json',
          ...(data
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
            : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
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

async function main() {
  const { status, body: wf } = await request('GET', `/workflows/${WF_ID}`);
  if (status !== 200) throw new Error(`GET workflow failed: ${status}`);

  const auth = wf.nodes.find((n) => String(n.name || '').includes('Autenticar'));
  if (!auth) throw new Error('Nó Autenticar Dapic não encontrado');

  auth.name = '🔐 Autenticar Dapic';
  auth.parameters = {
    method: 'POST',
    url: 'https://api.dapic.com.br/autenticacao/v1/login',
    sendBody: true,
    bodyParameters: {
      parameters: [
        { name: 'Empresa', value: EMPRESA },
        { name: 'TokenIntegracao', value: TOKEN },
      ],
    },
    options: {
      retry: { enabled: true, maxRetries: 3, retryInterval: 1000 },
    },
  };
  auth.retryOnFail = true;
  auth.maxTries = 3;
  auth.waitBetweenTries = 1000;

  const ctx = wf.nodes.find((n) => String(n.name || '').includes('Preparar'));
  if (ctx) ctx.parameters.jsCode = PREPARAR_CONTEXTO_CODE;

  const connections = wf.connections || {};
  if (connections['Autenticar Dapic'] && !connections['🔐 Autenticar Dapic']) {
    connections['🔐 Autenticar Dapic'] = connections['Autenticar Dapic'];
    delete connections['Autenticar Dapic'];
  }
  for (const key of Object.keys(connections)) {
    const branch = connections[key]?.main?.[0] || [];
    for (const edge of branch) {
      if (edge.node === 'Autenticar Dapic') edge.node = '🔐 Autenticar Dapic';
    }
  }
  if (connections['Definir Periodo (D-1)']) {
    connections['Definir Periodo (D-1)'].main = [
      [{ node: '🔐 Autenticar Dapic', type: 'main', index: 0 }],
    ];
  }

  const allowedSettings = [
    'executionOrder',
    'saveManualExecutions',
    'callerPolicy',
    'errorWorkflow',
    'timezone',
  ];
  const settings = {};
  for (const key of allowedSettings) {
    if (wf.settings?.[key] !== undefined) settings[key] = wf.settings[key];
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections,
    settings,
  };

  const put = await request('PUT', `/workflows/${WF_ID}`, payload);
  if (put.status >= 400) {
    console.error('PUT failed', put.status, JSON.stringify(put.body).slice(0, 600));
    process.exit(1);
  }

  console.log('✅ Workflow corrigido:', wf.name);
  console.log('   Auth: sem sendHeaders, credenciais literais, empresa=', EMPRESA);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
