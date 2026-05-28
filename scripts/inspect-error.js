/**
 * Inspeciona uma execucao especifica e mostra os erros por nó.
 * Uso: node scripts/inspect-error.js [executionId]
 */
const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const API_KEY = config.mcpServers?.['n8n-mcp']?.env?.N8N_API_KEY;
const HOST = 'workflows.tmrodrigues.tech';
const EXEC_ID = process.argv[2];

function get(path) {
  return new Promise((resolve, reject) => {
    https
      .get(
        { hostname: HOST, path: `/api/v1${path}`, headers: { 'X-N8N-API-KEY': API_KEY } },
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
  let execId = EXEC_ID;
  if (!execId) {
    const list = await get('/executions?workflowId=5vEtPrd4vzjCBK9w&limit=10');
    const lastErr = (list.data || []).find((e) => e.status === 'error');
    if (!lastErr) {
      console.log('Nenhuma execucao em erro encontrada nas ultimas 10.');
      return;
    }
    execId = lastErr.id;
    console.log('Usando ultima execucao em erro:', execId);
  }

  const det = await get(`/executions/${execId}?includeData=true`);
  console.log('\n=== Execucao', execId, '===');
  console.log('status :', det.status);
  console.log('mode   :', det.mode);
  console.log('started:', det.startedAt);
  console.log('stopped:', det.stoppedAt);

  const runData = det.data?.resultData?.runData || {};
  const errs = [];
  for (const [nodeName, runs] of Object.entries(runData)) {
    for (const r of runs || []) {
      if (r.error) {
        errs.push({
          node: nodeName,
          message: r.error.message,
          name: r.error.name,
          description: r.error.description,
          stack: (r.error.stack || '').split('\n').slice(0, 4).join('\n'),
          context: r.error.context || {},
        });
      }
    }
  }

  console.log('\n=== Erros encontrados (' + errs.length + ') ===');
  errs.forEach((e, i) => {
    console.log('\n[' + (i + 1) + '] node: ' + e.node);
    console.log('    name        :', e.name);
    console.log('    message     :', e.message);
    if (e.description) console.log('    description :', e.description);
    if (Object.keys(e.context).length) console.log('    context     :', JSON.stringify(e.context).slice(0, 400));
    if (e.stack) console.log('    stack:\n' + e.stack.split('\n').map((l) => '      ' + l).join('\n'));
  });

  const topError = det.data?.resultData?.error;
  if (topError) {
    console.log('\n=== Top-level error ===');
    console.log(' node    :', topError.node?.name);
    console.log(' message :', topError.message);
    console.log(' name    :', topError.name);
    if (topError.description) console.log(' descr   :', topError.description);
  }

  console.log('\n=== Nos executados ===');
  Object.keys(runData).forEach((n) => console.log(' -', n));
})().catch((e) => console.error('ERR', e.message || e));
