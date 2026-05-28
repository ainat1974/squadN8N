/**
 * Auditoria: gatilho Cron 06:00 + saude do pipeline ERP (workflow vivo).
 * Uso: node scripts/audit-cron-workflow.js [workflowId]
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

function findCronNode(nodes) {
  return nodes.find(
    (n) =>
      n.type === 'n8n-nodes-base.scheduleTrigger' ||
      /cron|schedule|diario|06:00/i.test(n.name || '')
  );
}

function findWebhookNode(nodes) {
  return nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
}

function cronExpression(node) {
  const p = node?.parameters || {};
  const rule = p.rule || {};
  if (rule.interval && Array.isArray(rule.interval)) {
    const cron = rule.interval.find((i) => i.field === 'cronExpression' || i.expression);
    if (cron) return cron.expression || cron.cronExpression || JSON.stringify(cron);
  }
  if (p.triggerTimes) return JSON.stringify(p.triggerTimes);
  return JSON.stringify(p).slice(0, 200);
}

function traceFromTrigger(connections, triggerName) {
  const out = connections[triggerName]?.main?.[0] || [];
  return out.map((c) => c.node);
}

function pipelineChain(connections, startNodes, maxDepth = 20) {
  const chain = [];
  let current = startNodes;
  const seen = new Set();
  for (let d = 0; d < maxDepth && current.length; d++) {
    const next = [];
    for (const name of current) {
      if (seen.has(name)) continue;
      seen.add(name);
      chain.push(name);
      const outs = connections[name]?.main?.[0] || [];
      for (const o of outs) {
        if (!seen.has(o.node)) next.push(o.node);
      }
    }
    current = next;
  }
  return chain;
}

function parseHourUTC(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return { utc: d.getUTCHours(), utcMin: d.getUTCMinutes(), brt: (d.getUTCHours() + 21) % 24 }; // UTC-3 aprox
}

function isNearSixAM(iso, tzHint) {
  const d = new Date(iso);
  const utcH = d.getUTCHours();
  const utcM = d.getUTCMinutes();
  // 06:00 America/Sao_Paulo = 09:00 UTC (sem horario de verao)
  if (tzHint === 'America/Sao_Paulo' || !tzHint) {
    return utcH === 9 && utcM < 15;
  }
  return utcH === 6 && utcM < 15;
}

(async () => {
  const wfRes = await get(`/workflows/${WF_ID}`);
  if (wfRes.status !== 200) {
    console.error('Falha ao ler workflow:', wfRes.status, JSON.stringify(wfRes.body).slice(0, 300));
    process.exit(1);
  }
  const wf = wfRes.body;
  const nodes = wf.nodes || [];
  const connections = wf.connections || {};
  const cronNode = findCronNode(nodes);
  const webhookNode = findWebhookNode(nodes);
  const timezone = wf.settings?.timezone || '(padrao do servidor n8n)';

  console.log('═══════════════════════════════════════════════════════════');
  console.log(' AUDITORIA — Workflow ERP Tech Malhas');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('1) WORKFLOW GERAL');
  console.log('   ID          :', wf.id);
  console.log('   Nome        :', wf.name);
  console.log('   Ativo       :', wf.active ? 'SIM' : 'NAO');
  console.log('   Atualizado  :', wf.updatedAt);
  console.log('   Timezone    :', timezone);
  console.log('   Total nos   :', nodes.length);

  console.log('\n2) GATILHO CRON (06:00)');
  if (!cronNode) {
    console.log('   ERRO: no Cron/Schedule Trigger encontrado no workflow!');
  } else {
    const expr = cronExpression(cronNode);
    const cronOk = /0\s+6\s+\*\s+\*\s+\*/.test(expr) || expr.includes('0 6 * * *');
    console.log('   No          :', cronNode.name);
    console.log('   Tipo        :', cronNode.type, 'v' + cronNode.typeVersion);
    console.log('   Expressao   :', expr);
    console.log('   Esperado    : 0 6 * * * (todo dia as 06:00)');
    console.log('   Expressao OK:', cronOk ? 'SIM' : 'NAO — revisar!');
    console.log('   disabled?   :', cronNode.disabled === true ? 'SIM (DESLIGADO!)' : 'nao');
    const cronTargets = traceFromTrigger(connections, cronNode.name);
    console.log('   Conecta para:', cronTargets.length ? cronTargets.join(' -> ') : '(NENHUMA CONEXAO!)');
  }

  console.log('\n3) GATILHO WEBHOOK MANUAL');
  if (webhookNode) {
    console.log('   No          :', webhookNode.name);
    console.log('   Path        :', webhookNode.parameters?.path || webhookNode.webhookId);
    const whTargets = traceFromTrigger(connections, webhookNode.name);
    console.log('   Conecta para:', whTargets.length ? whTargets.join(' -> ') : '(sem conexao)');
  }

  console.log('\n4) CADEIA PRINCIPAL (apos triggers)');
  const cronName = cronNode?.name;
  if (cronName) {
    const chain = pipelineChain(connections, traceFromTrigger(connections, cronName));
    console.log('   Cron ->', chain.slice(0, 12).join(' -> ') || '(vazia)');
    if (chain.length > 12) console.log('   ... +' + (chain.length - 12) + ' nos');
  }

  const expectedNodes = [
    'Definir Periodo',
    'Autenticar',
    'Coletar Vendas',
    'Transformar',
    'Salvar',
  ];
  const nodeNames = nodes.map((n) => n.name);
  console.log('\n5) NOS CRITICOS PRESENTES');
  for (const needle of expectedNodes) {
    const found = nodeNames.find((n) => n.toLowerCase().includes(needle.toLowerCase()));
    console.log('   ', found ? 'OK' : 'FALTA', '—', needle, found ? `(${found})` : '');
  }

  console.log('\n6) EXECUCOES RECENTES (ultimas 30)');
  const exRes = await get(`/executions?workflowId=${WF_ID}&limit=30`);
  const executions = exRes.body?.data || exRes.body || [];
  if (!executions.length) {
    console.log('   Nenhuma execucao encontrada.');
  } else {
    let success = 0;
    let error = 0;
    let cronLike = 0;
    const byMode = {};
    executions.forEach((e) => {
      if (e.status === 'success') success++;
      else if (e.status === 'error') error++;
      const mode = e.mode || 'unknown';
      byMode[mode] = (byMode[mode] || 0) + 1;
      if (isNearSixAM(e.startedAt, timezone === '(padrao do servidor n8n)' ? 'America/Sao_Paulo' : timezone)) {
        cronLike++;
      }
    });
    console.log('   Total listadas :', executions.length);
    console.log('   Sucesso        :', success);
    console.log('   Erro           :', error);
    console.log('   Por modo       :', JSON.stringify(byMode));
    console.log('   ~06:00 BRT     :', cronLike, 'execucao(oes) no horario esperado');
    console.log('');
    console.log('   ID       | status  | mode      | iniciou (UTC)              | duracao');
    console.log('   ' + '-'.repeat(72));
    for (const e of executions.slice(0, 15)) {
      const start = e.startedAt || '';
      const end = e.stoppedAt ? new Date(e.stoppedAt) - new Date(e.startedAt) : null;
      const dur = end != null ? Math.round(end / 1000) + 's' : '-';
      const near6 = isNearSixAM(start, 'America/Sao_Paulo') ? ' [~06h BRT]' : '';
      console.log(
        '   ' +
          String(e.id).padEnd(8) +
          ' | ' +
          String(e.status).padEnd(7) +
          ' | ' +
          String(e.mode || '-').padEnd(9) +
          ' | ' +
          start +
          ' | ' +
          dur +
          near6
      );
    }
  }

  const lastSuccess = executions.find((e) => e.status === 'success');
  const lastError = executions.find((e) => e.status === 'error');

  console.log('\n7) ULTIMA EXECUCAO COM SUCESSO');
  if (lastSuccess) {
    console.log('   ID:', lastSuccess.id, '|', lastSuccess.startedAt);
  } else {
    console.log('   Nenhuma nos ultimos 30 registros.');
  }

  if (lastError) {
    console.log('\n8) ULTIMA EXECUCAO COM ERRO');
    console.log('   ID:', lastError.id, '|', lastError.startedAt);
    const det = await get(`/executions/${lastError.id}?includeData=true`);
    const runData = det.body?.data?.resultData?.runData || {};
    for (const [nodeName, runs] of Object.entries(runData)) {
      for (const r of runs || []) {
        if (r.error) {
          console.log('   No com erro:', nodeName);
          console.log('   Mensagem   :', r.error.message || r.error);
        }
      }
    }
    const top = det.body?.data?.resultData?.error;
    if (top?.message) console.log('   Top error  :', top.message, '@', top.node?.name);
  }

  console.log('\n9) API DASHBOARD (smoke)');
  try {
    const https2 = require('https');
    const apiCheck = await new Promise((resolve) => {
      https2.get('https://workflows.tmrodrigues.tech/webhook/erp?modulo=resumo', (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            const j = JSON.parse(d);
            resolve({ status: res.statusCode, success: j.success, atualizadoEm: j.atualizadoEm, data: j.data });
          } catch {
            resolve({ status: res.statusCode, raw: d.slice(0, 120) });
          }
        });
      }).on('error', (e) => resolve({ error: e.message }));
    });
    console.log('   GET /webhook/erp?modulo=resumo');
    console.log('   HTTP       :', apiCheck.status);
    console.log('   success    :', apiCheck.success);
    console.log('   atualizado :', apiCheck.atualizadoEm || apiCheck.raw || apiCheck.error);
    console.log('   data ref   :', apiCheck.data);
  } catch (e) {
    console.log('   Falha:', e.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' VEREDITO');
  console.log('═══════════════════════════════════════════════════════════');
  const issues = [];
  if (!wf.active) issues.push('Workflow DESATIVADO no n8n');
  if (!cronNode) issues.push('No Cron ausente');
  if (cronNode?.disabled) issues.push('No Cron desabilitado');
  if (cronNode && !/0\s+6\s+\*\s+\*\s+\*/.test(cronExpression(cronNode))) {
    issues.push('Expressao cron diferente de 0 6 * * *');
  }
  if (cronNode && !traceFromTrigger(connections, cronNode.name).length) {
    issues.push('Cron sem conexao de saida');
  }
  if (error > 0 && success === 0) issues.push('Todas execucoes recentes falharam');
  if (issues.length === 0) {
    console.log(' Cron configurado, workflow ativo, pipeline conectado.');
    if (cronLike === 0 && executions.length > 0) {
      console.log(' ATENCAO: nenhuma execucao recente no horario ~06:00 BRT —');
      console.log(' pode ser que o cron ainda nao tenha disparado hoje ou timezone diferente.');
    }
  } else {
    issues.forEach((i) => console.log(' -', i));
  }
  console.log('');
})().catch((e) => {
  console.error('ERR', e.message || e);
  process.exit(1);
});
