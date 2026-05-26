---
task: "Configurar Agendamento e Instruções de Deploy"
order: 3
input: |
  - workflow_json: JSON do workflow gerado
output: |
  - deploy_instructions: Guia completo de importação, configuração e ativação no N8N
---

# Configurar Agendamento e Instruções de Deploy

Produz o guia completo para importar, configurar credenciais e ativar o workflow no N8N hospedado em https://workflows.tmrodrigues.tech/.

## Process

1. **Documentar o cron schedule**: Explicar a expressão cron usada e como ajustar o horário se necessário
2. **Listar variáveis e credenciais**: Todas as variáveis de ambiente e credenciais que devem ser configuradas no N8N antes de ativar
3. **Criar guia de importação passo a passo**: Como importar o JSON pelo N8N UI
4. **Documentar validação pós-deploy**: Como verificar que o workflow está funcionando (test execution, logs)
5. **Definir monitoramento**: Como acompanhar execuções e onde ver erros

## Output Format

```markdown
# Guia de Deploy — Workflow ERP Dapic

## 1. Importar o Workflow
1. Acesse https://workflows.tmrodrigues.tech/
2. Clique em [+ New Workflow] → [Import from file]
3. Selecione o arquivo workflow-n8n.json
4. Salve o workflow

## 2. Configurar Credenciais
### Variável: DAPIC_API_URL
- Settings → Variables → New Variable
- Name: DAPIC_API_URL | Value: [URL da API]

## 3. Ativar o Workflow
1. Clique no toggle [Active] no canto superior direito
2. O workflow passará a executar conforme o cron configurado

## 4. Validar Funcionamento
- Execute manualmente: [Test Workflow]
- Verifique: Executions → ver última execução
- Confirme: arquivos gerados em /data/erp/[data]/

## 5. Agendamento
- Expressão cron: `0 6 * * *`
- Significado: Todo dia às 06:00 (horário do servidor)
- Para ajustar: editar node "Cron Diário" → alterar cron expression
```

## Output Example

```markdown
# Guia de Deploy — Workflow ERP Dapic no N8N

## ⚠️ Pré-requisitos
- Acesso admin ao N8N em https://workflows.tmrodrigues.tech/
- Credenciais de acesso à API Dapic (usuário e senha)
- URL base da API Dapic

## 1. Importar o Workflow
1. Acesse https://workflows.tmrodrigues.tech/
2. No menu lateral, clique em **Workflows**
3. Clique no botão **+** → **Import from file**
4. Selecione o arquivo `workflow-n8n.json` gerado por este squad
5. O workflow será criado com o nome "ERP Dapic — Coleta Diária"
6. Clique em **Save** (Ctrl+S)

## 2. Configurar Variáveis de Ambiente
Em **Settings → Variables**, criar:

| Nome | Valor | Tipo |
|---|---|---|
| `DAPIC_API_URL` | `https://api.dapic.com.br` | String |
| `DAPIC_USER` | seu_usuario | Secret |
| `DAPIC_PASSWORD` | sua_senha | Secret |

> ⚠️ Use tipo **Secret** para usuário e senha — eles ficam criptografados.

## 3. Testar Antes de Ativar
1. Com o workflow aberto, clique em **Test Workflow**
2. Aguarde a execução completa (~2-3 minutos)
3. Verifique cada node clicando nele — deve mostrar dados de sucesso
4. Confirme que os arquivos JSON foram criados em `/data/erp/[data de hoje]/`

## 4. Ativar o Agendamento
1. Após teste bem-sucedido, clique no toggle **Active** (canto superior direito)
2. O status mudará para 🟢 **Active**
3. O workflow executará automaticamente todo dia às **06:00** (horário do servidor VPS)

## 5. Monitorar Execuções
- **Ver execuções**: Menu lateral → **Executions** → filtrar por "ERP Dapic"
- **Alertas de erro**: Configurado para notificar via webhook em caso de falha
- **Logs**: Cada execução registra status e duração

## 6. Ajustar Horário (se necessário)
- Abrir node **"Cron Diário 06h"**
- Alterar a expressão cron:
  - `0 6 * * *` = 06:00 todo dia
  - `0 8 * * *` = 08:00 todo dia
  - `0 6 * * 1-5` = 06:00 apenas dias úteis (seg-sex)
```

## Quality Criteria

- [ ] URL do N8N referenciada corretamente (https://workflows.tmrodrigues.tech/)
- [ ] Todas as variáveis de ambiente listadas com tipo (string/secret)
- [ ] Passo de teste antes de ativar incluído
- [ ] Expressão cron documentada e explicada
- [ ] Instruções de monitoramento incluídas

## Veto Conditions

Rejeitar e refazer se:
1. Credenciais reais aparecem no guia (deve usar placeholders)
2. Não há instrução de teste antes de ativar o workflow
