const fs = require('fs');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const n8nConfig = config.mcpServers?.['n8n-mcp']?.env || {};
const apiUrl = (n8nConfig.N8N_API_URL || '').replace(/\/+$/, '');
const apiKey = n8nConfig.N8N_API_KEY;

if (!apiUrl || !apiKey || apiKey.includes('SEU_N8N')) {
  throw new Error('N8N API URL/key nao configurados em .mcp.json');
}

async function request(path) {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    headers: {
      Accept: 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
  });
  if (!response.ok) throw new Error(`GET ${path} failed ${response.status}`);
  return response.json();
}

(async () => {
  const result = await request('/workflows?limit=100');
  const workflows = Array.isArray(result) ? result : result.data || [];
  const summary = [];

  for (const workflow of workflows) {
    const detail = await request(`/workflows/${workflow.id}`);
    const webhooks = (detail.nodes || [])
      .filter(node => node.type === 'n8n-nodes-base.webhook')
      .map(node => ({
        name: node.name,
        path: node.parameters?.path,
        method: node.parameters?.httpMethod,
        responseMode: node.parameters?.responseMode,
      }));
    const responseNodes = (detail.nodes || [])
      .filter(node => node.type === 'n8n-nodes-base.respondToWebhook')
      .map(node => ({
        name: node.name,
        options: node.parameters?.options,
      }));

    if (webhooks.length || responseNodes.length || /erp|dashboard|dapic|tech/i.test(detail.name)) {
      summary.push({
        id: detail.id,
        name: detail.name,
        active: detail.active,
        webhooks,
        responseNodes,
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
})();
