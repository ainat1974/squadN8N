---
task: "Criar Identidade Visual e Design System"
order: 1
input: |
  - data_schema: Schema de dados e KPIs a exibir
output: |
  - visual_identity: Paleta de cores, tipografia, tokens CSS e design system
---

# Criar Identidade Visual e Design System

Define a identidade visual completa do dashboard — paleta de cores, tipografia, espaçamento e tokens de design — como base para todos os componentes.

## Process

1. **Definir paleta de cores**: Cores primárias, semânticas (positivo/negativo/neutro/alerta) e de fundo, com valores HEX e ratios de contraste WCAG
2. **Definir tipografia**: Família de fonte (Google Fonts, licença livre), escala de tamanhos e pesos para cada hierarquia (H1, H2, body, label, caption)
3. **Definir espaçamento**: Sistema de grid e escala de espaçamento (4px base)
4. **Gerar tokens CSS**: Todas as decisões como CSS custom properties (`--color-*`, `--font-*`, `--space-*`)
5. **Definir tema dark/light**: Variações para modo escuro e claro usando os mesmos tokens

## Output Format

```markdown
# Design System — ERP Dashboard

## Paleta de Cores
| Token | HEX | Uso | Contraste (sobre branco) |
|---|---|---|---|
| --color-primary | #1E40AF | Ações principais, links | 7.8:1 ✅ WCAG AAA |
| --color-success | #059669 | Crescimento, positivo | 4.6:1 ✅ WCAG AA |

## Tipografia
- **Família**: Inter (Google Fonts)
- **H1**: 32px / Bold 700 / --color-text-primary
- **Body**: 16px / Regular 400 / --color-text-secondary

## Tokens CSS
```css
:root {
  --color-primary: #1E40AF;
  --color-success: #059669;
  --font-family: 'Inter', sans-serif;
  --space-4: 16px;
}
```
```

## Output Example

```markdown
# Design System — ERP Dashboard Dapic

## 🎨 Paleta de Cores

### Cores de Marca
| Token CSS | HEX | RGB | Uso |
|---|---|---|---|
| `--color-primary` | `#1E40AF` | 30, 64, 175 | Botões, links, elementos de destaque |
| `--color-primary-light` | `#DBEAFE` | 219, 234, 254 | Backgrounds de cards primários |
| `--color-secondary` | `#0F172A` | 15, 23, 42 | Sidebar, header principal |

### Cores Semânticas
| Token CSS | HEX | Uso | Contraste WCAG |
|---|---|---|---|
| `--color-success` | `#059669` | Crescimento, metas atingidas, CR recebido | 4.6:1 ✅ AA |
| `--color-danger` | `#DC2626` | Queda, alertas, CP vencido | 4.5:1 ✅ AA |
| `--color-warning` | `#D97706` | Atenção, vencimento próximo | 4.8:1 ✅ AA |
| `--color-info` | `#0284C7` | Informação neutra, estoque | 4.7:1 ✅ AA |

### Cores de Interface
| Token CSS | HEX | Uso |
|---|---|---|
| `--color-bg-page` | `#F8FAFC` | Fundo da página |
| `--color-bg-card` | `#FFFFFF` | Fundo de cards |
| `--color-border` | `#E2E8F0` | Bordas e divisores |
| `--color-text-primary` | `#0F172A` | Textos principais |
| `--color-text-secondary` | `#475569` | Textos secundários, labels |

## 📝 Tipografia
- **Família principal**: Inter (Google Fonts — gratuita, excelente legibilidade em dados)
- **Família monospace**: JetBrains Mono (para números e valores monetários)

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| KPI Value | 36px | Bold 700 | --color-text-primary |
| Card Title | 14px | Medium 500 | --color-text-secondary |
| Section H2 | 20px | SemiBold 600 | --color-text-primary |
| Body | 16px | Regular 400 | --color-text-primary |
| Label/Caption | 12px | Regular 400 | --color-text-secondary |

## 📐 Sistema de Espaçamento (base 4px)
```
--space-1: 4px    --space-4: 16px   --space-8: 32px
--space-2: 8px    --space-5: 20px   --space-10: 40px
--space-3: 12px   --space-6: 24px   --space-16: 64px
```

## 🎛️ Tokens CSS Completos
```css
:root {
  /* Cores de Marca */
  --color-primary: #1E40AF;
  --color-primary-light: #DBEAFE;
  --color-secondary: #0F172A;

  /* Cores Semânticas */
  --color-success: #059669;
  --color-success-light: #D1FAE5;
  --color-danger: #DC2626;
  --color-danger-light: #FEE2E2;
  --color-warning: #D97706;
  --color-warning-light: #FEF3C7;
  --color-info: #0284C7;
  --color-info-light: #E0F2FE;

  /* Interface */
  --color-bg-page: #F8FAFC;
  --color-bg-card: #FFFFFF;
  --color-border: #E2E8F0;
  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;

  /* Tipografia */
  --font-family: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;

  /* Sombras */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-hover: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);
}
```
```

## Quality Criteria

- [ ] Paleta completa com tokens CSS definidos
- [ ] Todos os ratios de contraste calculados e atendendo WCAG AA (mínimo 4.5:1)
- [ ] Tipografia definida com tamanhos, pesos e uso para cada hierarquia
- [ ] Sistema de espaçamento baseado em escala consistente (4px base)
- [ ] Tokens CSS prontos para copiar no projeto

## Veto Conditions

Rejeitar e refazer se:
1. Alguma cor semântica não atinge contraste WCAG AA (4.5:1 mínimo)
2. Tokens CSS não foram gerados (apenas descrição sem código)
