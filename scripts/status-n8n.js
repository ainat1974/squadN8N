/**
 * Mostra status atual do workflow vivo no n8n + ultimas execucoes.
 * So leitura — nao altera nada.
 */
const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const API_KEY = config.mcpServers?.['n8n-mcp']?.env?.N8N_API_KEY;
const HOST = 'workflows.tmrodrigues.tech';
const WF_ID = process.argv[2] || '5vEtPrd4vzjCBK9w';

function get(path) {
  return new Promise((resolve, reject) => {
    https
      .get(
        { hostname: HOST, path: `/api/v1${path}`, headers: { 'X-N8N-API-KEY': API_KEY, Accept: 'application/json' } },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
          });
        }
      )
      .on('error', reject);
  });
}

(async () => {
  const wf = await get(`/workflows/${WF_ID}`);
  console.log('=== Workflow ===');
  console.log('id        :', wf.id);
  console.log('name      :', wf.name);
  console.log('active    :', wf.active);
  console.log('updatedAt :', wf.updatedAt);
  console.log('total nos :', wf.nodes.length);

  const shortType = (t) =>
    String(t || '')
      .replace('@n8n/n8n-nodes-langchain.', 'lc.')
      .replace('n8n-nodes-base.', '');

  console.log('\n=== Pipeline (ordenada por posicao X) ===');
  wf.nodes
    .slice()
    .sort((a, b) => (a.position?.[0] || 0) - (b.position?.[0] || 0))
    .forEach((n, i) => {
      console.log(String(i + 1).padStart(2, ' ') + '. ' + n.name + '  [' + shortType(n.type) + ']');
    });

  const ex = await get(`/executions?workflowId=${WF_ID}&limit=5`);
  console.log('\n=== Ultimas 5 execucoes ===');
  (ex.data || []).forEach((e) => {
    console.log(' - ' + e.id + ' | ' + e.status + ' | iniciou ' + e.startedAt + ' | finalizou ' + (e.stoppedAt || '(em andamento)'));
  });
})().catch((e) => console.error('ERR', e.message || e));
