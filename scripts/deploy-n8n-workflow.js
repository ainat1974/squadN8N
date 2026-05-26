const fs = require('fs');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const n8nConfig = config.mcpServers?.['n8n-mcp']?.env || {};
const apiUrl = (n8nConfig.N8N_API_URL || '').replace(/\/+$/, '');
const apiKey = n8nConfig.N8N_API_KEY;

if (!apiUrl || !apiKey || apiKey.includes('SEU_N8N')) {
  throw new Error('N8N API URL/key nao configurados em .mcp.json');
}

const workflowPath = 'squads/n8n-erp-dashboard/output/workflow-n8n-otimizado.json';
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-N8N-API-KEY': apiKey,
};

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`${options.method || 'GET'} ${path} failed ${response.status}: ${detail.slice(0, 800)}`);
  }

  return body;
}

function workflowPayload() {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {},
    staticData: workflow.staticData || null,
  };
}

async function listWorkflows() {
  const result = await request('/workflows?limit=100');
  return Array.isArray(result) ? result : (result.data || []);
}

async function main() {
  const workflows = await listWorkflows();
  const candidates = [
    workflow.name,
    'Tech Malhas — Coleta ERP Dapic',
    'Tech Malhas - Coleta ERP Dapic',
    'Tech Malhas - Coleta ERP Dapic Otimizado',
  ];

  const existing = workflows.find(item => candidates.includes(item.name));
  const wasActive = Boolean(existing?.active);
  let saved;

  if (existing) {
    if (wasActive) {
      try {
        await request(`/workflows/${existing.id}/deactivate`, { method: 'POST' });
      } catch {
        // Some n8n versions allow updating active workflows. Continue to update.
      }
    }

    saved = await request(`/workflows/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(workflowPayload()),
    });
  } else {
    saved = await request('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflowPayload()),
    });
  }

  const id = saved.id || existing?.id;
  let active = false;

  if (id) {
    const activated = await request(`/workflows/${id}/activate`, { method: 'POST' });
    active = Boolean(activated.active ?? true);
  }

  console.log(JSON.stringify({
    ok: true,
    action: existing ? 'updated' : 'created',
    id,
    name: workflow.name,
    nodes: workflow.nodes.length,
    active,
  }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
