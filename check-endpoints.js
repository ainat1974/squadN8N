const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWQyZDYyNy05NDQwLTRiZWMtYjcwMS1hZDZmZThlM2M3ODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2U3NGNjNGItMWE3MC00MmMyLWE1ZWYtNjZmYTI4MDcxYTZjIiwiaWF0IjoxNzc5NzUwMzE5fQ.qt_jMJ4J8hrev6xeCUd2SLk8LvmdF1X510KDh8_iav4';

function get(id) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'workflows.tmrodrigues.tech',
      path: '/api/v1/workflows/' + id,
      method: 'GET',
      headers: { 'X-N8N-API-KEY': API_KEY, 'Accept': 'application/json' }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject); req.end();
  });
}

async function main() {
  const workflows = [
    { id: 'UXwWz2TtspXmljL1', nome: 'LITE' },
    { id: 'K7nwMM7I2Wy2Q1HC', nome: 'PDV+Estoque' },
    { id: 'zo7k3xUjvFIHdzWN', nome: 'Vendas PDV Diário' }
  ];

  for (const { id, nome } of workflows) {
    const wf = await get(id);
    console.log('\n=== ' + nome + ': ' + wf.name + ' ===');

    wf.nodes.forEach(n => {
      // URLs diretas em HTTP Request nodes
      if (n.parameters?.url && n.parameters.url.includes('dapic')) {
        console.log('  [HTTP] ' + n.name + ':');
        console.log('    URL:', n.parameters.url);
        // query params
        const qp = n.parameters?.queryParameters?.parameters || n.parameters?.qs || [];
        if (Array.isArray(qp) && qp.length > 0) {
          qp.forEach(p => console.log('    param:', p.name, '=', p.value));
        }
      }

      // URLs em Code nodes (jsCode)
      if (n.parameters?.jsCode && n.parameters.jsCode.includes('dapic.com.br')) {
        const urlMatches = [...new Set(n.parameters.jsCode.match(/\/v\d+\/[a-zA-Z0-9\/\-_]+/g) || [])];
        if (urlMatches.length > 0) {
          console.log('  [CODE] ' + n.name + ':');
          urlMatches.forEach(u => console.log('    endpoint:', u));
        }
      }
    });
  }
}
main().catch(console.error);
