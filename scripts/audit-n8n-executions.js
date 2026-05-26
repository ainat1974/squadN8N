const fs = require('fs');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const env = config.mcpServers?.['n8n-mcp']?.env || {};
const apiUrl = (env.N8N_API_URL || '').replace(/\/+$/, '');
const apiKey = env.N8N_API_KEY;
const workflowId = process.argv[2] || '5vEtPrd4vzjCBK9w';
const executionId = process.argv[3];

async function request(path) {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    headers: { Accept: 'application/json', 'X-N8N-API-KEY': apiKey },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`GET ${path} failed ${response.status}: ${text.slice(0, 500)}`);
  return body;
}

(async () => {
  const list = executionId ? null : await request(`/executions?workflowId=${workflowId}&limit=5&includeData=false`);
  const executions = list ? (Array.isArray(list) ? list : list.data || []) : [];
  const latest = executionId ? { id: executionId } : executions[0];
  if (!latest) {
    console.log(JSON.stringify({ executions: [] }, null, 2));
    return;
  }

  const detail = await request(`/executions/${latest.id}?includeData=true`);
  const runData = detail.data?.resultData?.runData || {};
  const lastNode = Object.entries(runData).at(-1);
  const errors = [];

  for (const [nodeName, runs] of Object.entries(runData)) {
    for (const run of runs || []) {
      if (run.error) {
        errors.push({ nodeName, error: run.error });
      }
    }
  }

  console.log(JSON.stringify({
    latest: {
      id: latest.id,
      status: latest.status,
      mode: latest.mode,
      startedAt: latest.startedAt,
      stoppedAt: latest.stoppedAt,
      finished: latest.finished,
    },
    lastNode: lastNode?.[0],
    errors,
  }, null, 2));
})();
