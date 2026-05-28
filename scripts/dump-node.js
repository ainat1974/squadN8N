/* Dump completo do jsCode de um node do workflow ERP. */
const fs = require('fs');
const https = require('https');
const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const API_KEY = config.mcpServers?.['n8n-mcp']?.env?.N8N_API_KEY;
const WF_ID = process.argv[2] || '5vEtPrd4vzjCBK9w';
const NODE = process.argv[3] || 'Ler Dados ERP';

function get(path) {
  return new Promise((resolve, reject) => {
    https
      .get(
        { hostname: 'workflows.tmrodrigues.tech', path: `/api/v1${path}`, headers: { 'X-N8N-API-KEY': API_KEY } },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => resolve(JSON.parse(raw)));
        }
      )
      .on('error', reject);
  });
}

(async () => {
  const wf = await get(`/workflows/${WF_ID}`);
  const node = wf.nodes.find((n) => n.name.includes(NODE));
  if (!node) {
    console.error('Node nao encontrado:', NODE);
    process.exit(1);
  }
  console.log('=== Node:', node.name, '===');
  console.log('id:', node.id, 'type:', node.type);
  console.log('--- jsCode ---');
  console.log(node.parameters?.jsCode || '(vazio)');
})().catch((e) => console.error(e.message));
