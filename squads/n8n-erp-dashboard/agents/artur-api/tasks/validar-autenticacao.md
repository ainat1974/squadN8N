---
task: "Validar Autenticação da API"
order: 2
input: |
  - auth_method: Método de autenticação identificado na task anterior
  - endpoints_map: Mapa de endpoints documentado
output: |
  - auth_flow: Fluxo completo de autenticação documentado com exemplos
  - n8n_credentials: Configuração de credenciais para o N8N
---

# Validar Autenticação da API Dapic

Documenta e valida o fluxo completo de autenticação da API Dapic, produzindo as instruções precisas para configuração das credenciais no N8N.

## Process

1. **Documentar o fluxo de autenticação**: Passo a passo desde a obtenção do token até o uso nas requisições subsequentes
2. **Definir estratégia de renovação de token**: Se o token expira, documentar quando e como renovar (antes de expirar, ao receber 401, etc.)
3. **Mapear configuração no N8N**: Especificar como configurar as credenciais no N8N (Header Auth, API Key, ou credencial customizada)
4. **Definir variáveis de ambiente**: Listar todas as variáveis que devem ser configuradas como secrets no N8N (nunca hardcoded)
5. **Documentar tratamento de erros de auth**: Código 401 (token expirado), 403 (permissão negada) — estratégia de retry e alerta

## Output Format

```markdown
# Fluxo de Autenticação — API Dapic

## Visão Geral
[Descrição do método de autenticação]

## Passo a Passo

### 1. Obter Token de Acesso
- **Endpoint**: POST [URL]
- **Headers**: Content-Type: application/json
- **Body**: { ... }
- **Resposta**: { "access_token": "...", "expires_in": 3600 }

### 2. Usar Token nas Requisições
- **Header**: Authorization: Bearer {{access_token}}

### 3. Renovar Token (se necessário)
- **Quando**: [condição de renovação]
- **Como**: [processo de renovação]

## Configuração no N8N

### Credenciais Necessárias
| Variável | Descrição | Onde configurar |
|---|---|---|
| DAPIC_API_URL | URL base da API | N8N Credentials |
| DAPIC_USER | Usuário de acesso | N8N Credentials |
| DAPIC_PASSWORD | Senha de acesso | N8N Credentials |

### Tipo de Credencial no N8N
[Header Auth / Generic Credential / Custom]

## Tratamento de Erros de Auth
- **401 Unauthorized**: Token expirado — renovar e retry
- **403 Forbidden**: Permissão insuficiente — verificar escopo do usuário
```

## Output Example

```markdown
# Fluxo de Autenticação — API Dapic v2.1

## Visão Geral
A API Dapic usa autenticação OAuth2 com JWT Bearer Token. O token tem validade de 1 hora e deve ser renovado antes de expirar para evitar interrupção no workflow.

## Passo a Passo

### 1. Obter Token de Acesso
- **Endpoint**: `POST {{DAPIC_API_URL}}/api/auth/token`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "username": "{{DAPIC_USER}}",
    "password": "{{DAPIC_PASSWORD}}"
  }
  ```
- **Resposta de sucesso** (200):
  ```json
  {
    "access_token": "eyJhbGc...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
  ```

### 2. Usar Token nas Requisições
Adicionar em todas as requisições:
`Authorization: Bearer {{access_token}}`

### 3. Estratégia de Renovação
- Renovar o token a cada 50 minutos (antes dos 60min de expiração)
- No N8N: usar node "Function" para verificar timestamp do último token

## Configuração no N8N
| Variável | Valor | Tipo |
|---|---|---|
| DAPIC_API_URL | https://api.dapic.com.br | N8N Credential (string) |
| DAPIC_USER | seu_usuario | N8N Credential (secret) |
| DAPIC_PASSWORD | sua_senha | N8N Credential (secret) |

## Tratamento de Erros
- **401**: Executar node de renovação de token e retry da requisição original
- **403**: Enviar alerta — verificar permissões do usuário na Dapic
- **429**: Rate limit atingido — aguardar 60s e retry
```

## Quality Criteria

- [ ] Fluxo de autenticação documentado passo a passo
- [ ] Estratégia de renovação de token definida
- [ ] Todas as variáveis de ambiente listadas (sem valores reais)
- [ ] Tratamento de erros 401, 403 e 429 documentado
- [ ] Configuração específica para o N8N especificada

## Veto Conditions

Rejeitar e refazer se:
1. Alguma credential real (senha, token) aparece na documentação (deve usar apenas placeholders `{{}}`)
2. Não há estratégia definida para renovação de token ou tratamento de erro 401
