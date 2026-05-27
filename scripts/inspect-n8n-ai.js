/**
 * Inspeciona o n8n: lista credenciais e workflows que usam nodes de IA.
 * Output: o que está disponível para o "Agente IA" no fluxo principal.
 */
const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const API_KEY = config.mcpServers?.['n8n-mcp']?.env?.N8N_API_KEY;
const HOST = 'workflows.tmrodrigues.tech';

function get(path) {
  return new Promise((resolve, reject) => {
    https
      .get(
        {
          hostname: HOST,
          path: `/api/v1${path}`,
          headers: { 'X-N8N-API-KEY': API_KEY, Accept: 'application/json' },
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
      )
      .on('error', reject);
  });
}

const aiTypePattern =
  /openAi|anthropic|gemini|googlePalm|ollama|huggingface|cohere|langchain|llm|chat|embedding/i;

const aiCredPattern =
  /openAiApi|anthropicApi|googleGeminiApi|googlePalmApi|cohereApi|ollamaApi|huggingFace/i;

(async () => {
  console.log('\n=== Credenciais ===');
  const creds = await get('/credentials?limit=200');
  if (creds.status !== 200) {
    console.log('status:', creds.status, JSON.stringify(creds.body).slice(0, 300));
  } else {
    const arr = Array.isArray(creds.body) ? creds.body : creds.body.data || [];
    if (!arr.length) console.log('(nenhuma credencial retornada — pode exigir owner)');
    arr.forEach((c) => {
      const flag = aiCredPattern.test(c.type) ? '  [IA]' : '';
      console.log(` - ${c.name}  | type=${c.type}${flag}`);
    });
  }

  console.log('\n=== Workflows com nodes de IA ===');
  const wfs = await get('/workflows?limit=200');
  const arr = wfs.body.data || wfs.body || [];
  let foundAny = false;
  for (const wf of arr) {
    const nodes = wf.nodes || [];
    const aiNodes = nodes.filter((n) => aiTypePattern.test(n.type || ''));
    if (aiNodes.length) {
      foundAny = true;
      console.log(`\n* ${wf.name}  (id ${wf.id}, active=${wf.active})`);
      aiNodes.forEach((n) => {
        const credKeys = Object.keys(n.credentials || {});
        console.log(`    - ${n.name}  | ${n.type}  | creds: ${credKeys.join(', ') || '(nenhuma)'}`);
      });
    }
  }
  if (!foundAny) console.log('(nenhum workflow utiliza nodes de IA)');

  console.log('\n=== Resumo ===');
  console.log(`Total workflows: ${arr.length}`);
})().catch((err) => {
  console.error('ERR', err.message || err);
  process.exit(1);
});
