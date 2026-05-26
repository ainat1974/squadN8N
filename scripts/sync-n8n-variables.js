const fs = require('fs');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const env = config.mcpServers?.['n8n-mcp']?.env || {};
const apiUrl = (env.N8N_API_URL || '').replace(/\/+$/, '');
const apiKey = env.N8N_API_KEY;

const credentials = fs.readFileSync('squads/n8n-erp-dashboard/_memory/credentials.md', 'utf8');
const empresa = credentials.match(/\*\*Empresa \(Identificador\)\*\*\s*\|\s*`([^`]+)`/)?.[1];
const token = credentials.match(/\*\*TokenIntegracao\*\*\s*\|\s*`([^`]+)`/)?.[1];

if (!empresa || !token) throw new Error('Credenciais Dapic nao encontradas em credentials.md');

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed ${response.status}: ${text.slice(0, 800)}`);
  return body;
}

async function upsertVariable(key, value) {
  const list = await request('/variables');
  const variables = Array.isArray(list) ? list : list.data || [];
  const existing = variables.find(item => item.key === key);

  if (existing) {
    await request(`/variables/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ key, value }),
    });
    return 'updated';
  }

  await request('/variables', {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  });
  return 'created';
}

(async () => {
  const results = {
    DAPIC_EMPRESA: await upsertVariable('DAPIC_EMPRESA', empresa),
    DAPIC_TOKEN_INTEGRACAO: await upsertVariable('DAPIC_TOKEN_INTEGRACAO', token),
  };
  console.log(JSON.stringify({ ok: true, results }, null, 2));
})();
