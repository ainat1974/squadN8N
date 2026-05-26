# Anti-Patterns — N8N ERP Dashboard Squad

## Anti-Patterns de Integração de API

### 🚫 Credentials Hardcoded
**Erro**: `Authorization: Bearer eyJhbGc...` direto no código ou no JSON do workflow N8N
**Por que é grave**: Qualquer pessoa com acesso ao repositório ou ao workflow exportado tem acesso à API
**Correção**: Sempre usar `{{$vars.DAPIC_API_TOKEN}}` ou N8N Credentials

### 🚫 Ignorar Paginação
**Erro**: Chamar apenas `GET /vendas` sem verificar `meta.total_pages`
**Por que é grave**: Dashboard exibe dados incompletos sem aviso — métricas falsas
**Correção**: Implementar loop que verifica `page < total_pages` antes de parar

### 🚫 Assumir Schema Sem Validar
**Erro**: Usar campo `valor_total` sem verificar se é `number` ou `string`
**Por que é grave**: `"1.500,00" * 1.1` = `NaN` — erro silencioso no dashboard
**Correção**: Sempre mapear tipos e aplicar transformação antes de usar

### 🚫 Ignorar Rate Limits
**Erro**: Fazer 10 requisições simultâneas sem delay
**Por que é grave**: API retorna 429 e coleta falha — dados do dia perdidos
**Correção**: Implementar Wait node de 1000ms entre requisições

---

## Anti-Patterns de Workflow N8N

### 🚫 HTTP Request Sem Error Handler
**Erro**: Node HTTP Request sem branch de erro mapeado
**Por que é grave**: Falha silenciosa — workflow termina sem dados, sem alerta
**Correção**: Todo HTTP Request deve ter `onError: 'continueErrorOutput'` e branch de tratamento

### 🚫 Workflow Não Idempotente
**Erro**: Append em arquivo sem verificar se já existe entrada do dia
**Por que é grave**: Executar duas vezes duplica todos os dados — métricas dobradas
**Correção**: Usar modo `write` (sobrescrever) em vez de append, ou verificar existência

### 🚫 Token Sem Renovação
**Erro**: Obter token uma vez e reutilizar sem verificar expiração
**Por que é grave**: Coleta de dados começa, token expira no meio, 401 derruba tudo
**Correção**: Verificar expiração antes de cada batch ou renovar a cada 50 minutos

---

## Anti-Patterns de Dados

### 🚫 Monetário Como String
**Erro**: Armazenar `valor_total: "1.500,00"` no JSON de saída
**Por que é grave**: `Chart.js` recebe string, gráfico quebra ou mostra zero
**Correção**: Sempre converter: `parseFloat(v.replace(/\./g, '').replace(',', '.'))`

### 🚫 Sobrescrever Histórico
**Erro**: Salvar sempre em `data/erp/latest/vendas.json` (sobreescrevendo)
**Por que é grave**: Perde rastreabilidade — sem como analisar tendências históricas
**Correção**: Salvar em `data/erp/YYYY-MM-DD/vendas.json` + manter symlink `latest`

---

## Anti-Patterns de Frontend

### 🚫 Fetch Sem Try/Catch
**Erro**: `fetch('/api/vendas').then(r => r.json()).then(setData)` sem `.catch`
**Por que é grave**: Erro de rede derruba o componente inteiro com erro não tratado
**Correção**: Sempre usar try/catch com estado de erro + UI de fallback

### 🚫 `any` em TypeScript
**Erro**: `const data: any = await fetch(...)...`
**Por que é grave**: Perde toda a segurança de tipos — bugs escapam para produção
**Correção**: Definir interfaces para cada schema de dados do Dante Dados

### 🚫 Formatação Monetária Manual
**Erro**: `"R$ " + value.toFixed(2)` — não trata separadores pt-BR
**Por que é grave**: Mostra "R$ 1500.00" em vez de "R$ 1.500,00"
**Correção**: `new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(value)`

### 🚫 Sem Estado de Loading
**Erro**: Renderizar componente vazio enquanto dados carregam
**Por que é grave**: Usuário vê tela em branco ou valores zerados — parece bug
**Correção**: Skeleton loader em todos os componentes com fetch

### 🚫 CORS Aberto em Produção
**Erro**: `app.use(cors())` sem especificar origin
**Por que é grave**: Qualquer site pode fazer requisições à API — risco de segurança
**Correção**: `app.use(cors({ origin: process.env.FRONTEND_URL }))`
