# Taketrip — Frontend Guidelines

> Direção visual e UX do produto. Este documento é a fonte de verdade para qualquer pessoa que esteja construindo, prototipando ou revisando interface no Taketrip.

---

## 0 · Princípios

> Excursão é trabalho de rua, no celular, com pressa. A interface deve parecer um colega prestativo — não um sistema corporativo.

| # | Princípio | O que significa na prática |
|---|---|---|
| 01 | **Rapidez** | 1–2 toques para tarefas críticas. Nenhuma tela operacional pode exigir scroll para encontrar a ação primária. |
| 02 | **Clareza** | Status visível antes do texto. Cor carrega significado, ícone reforça. |
| 03 | **Calor** | Tom humano, sem jargão técnico. Tipografia humanista, paleta quente. |

**Regra de ouro:** se uma tela operacional exige scroll para a ação primária, é preciso repensá-la.

---

## 1 · Cor

### Tokens

```css
:root {
  /* Superfície */
  --tt-bg:           #fffaf5;  /* off-white quente (background do app) */
  --tt-surface:      #ffffff;  /* cards, sheets */
  --tt-surface-2:    #faf6f1;  /* superfície secundária, hover */
  --tt-border:       #ece7e0;  /* divisores, contornos padrão */
  --tt-border-soft:  #f3efe9;  /* divisores internos sutis */

  /* Texto (cinzas-pedra, quentes) */
  --tt-ink:        #1c1917;    /* texto primário */
  --tt-ink-mute:   #57534e;    /* texto secundário */
  --tt-ink-soft:   #a8a29e;    /* labels, legendas, ícones */
  --tt-ink-faint:  #d6d3d1;    /* chevrons, hairlines */

  /* Marca — teal em teste (ver §1b) */
  --tt-primary:        #0a9396;  /* teal — ação primária */
  --tt-primary-press:  #067274;  /* estado pressed/active */
  --tt-primary-soft:   #e5f5f5;  /* fundo de chips, badges primary */
  --tt-accent:         #fbcdb6;  /* destaque sutil — coral quente */
  --tt-accent-ink:     #7d2d12;  /* texto sobre accent */

  /* Status */
  --tt-success:        #15803d;
  --tt-success-soft:   #e6f4ea;
  --tt-warning:        #b45309;
  --tt-warning-soft:   #fef3c7;
  --tt-danger:         #b91c1c;
  --tt-danger-soft:    #fde8e7;
}
```

### Diretrizes

- **Fundo do app:** `--tt-bg`, nunca `#fff` puro. O calor da base é parte da identidade.
- **Texto sobre fundos coloridos:** use o `*-soft` correspondente como fundo e a cor "forte" como texto (ex.: `bg: success-soft`, `text: success`).
- **Evite azuis frios.** Não introduza azul nem para informativo — use `--tt-ink-mute`. Exceção deliberada: `--tt-primary` (teal, ver §1b) fica no limite ciano/verde-azulado por pedido explícito de teste — os tokens de apoio (texto, superfície) continuam neutros e quentes para o produto não esfriar como um todo.
- **Cores de status são funcionais, não decorativas.** Não use `success` apenas porque "fica bonito".
- Nunca invente nova cor sem adicioná-la à tabela acima.

### 1b · Paleta teal — fundamentação (teste, 07/07/2026)

A paleta laranja original não combinou tematicamente com "excursão/turismo" na avaliação do Matheus. Esta seção documenta a paleta alternativa gerada a partir de `#0A9396` como `--tt-primary`, produzida seguindo teoria das cores (não é escolha arbitrária) — **status: em teste**, ainda não é definitiva até validação visual.

**Harmonia:** `#0A9396` é HSL(181°, 87%, 31%) — um teal saturado e escuro, na fronteira entre ciano e verde-azulado. Evoca água/litoral/estrada, temática natural para viagem — mais alinhado ao produto do que o laranja corporativo-quente anterior. Para `--tt-accent`, em vez de outro tom quente aleatório, usei o **quase-complementar** do teal (a roda de cores coloca o complemento de 181° perto de 1°, um vermelho-coral) — isso mantém o "calor humano" do produto (princípio 03) mesmo com uma marca mais fria, e cria contraste vivo sem recorrer a azul ou a decisões desconectadas de teoria de cor.

**Escala derivada do primary** (mesma lógica de antes — só a base mudou):
- `--tt-primary-press` = teal mais escuro/saturado (L 31%→24%, S 87%→90%) para estado pressed.
- `--tt-primary-soft` = tint quase-branco do mesmo hue (L→93%, S→45%) para fundo de chip/badge.
- `--tt-accent` = tint claro do coral complementar (H 20°, S 90%, L 85%); `--tt-accent-ink` = a versão escura e saturada do mesmo hue (H 15°, S 75%, L 28%) para texto legível sobre ele.

**Superfícies e texto (`--tt-bg`, `--tt-ink*`) não mudaram** — propositalmente. Área grande de tela não deve carregar o hue da marca; só marca/destaque devem. Isso também limita o risco de o produto esfriar visualmente como um todo.

**Contraste verificado (WCAG 2.1, fórmula de luminância relativa, calculado — não estimado):**

| Combinação real usada no produto | Contraste | Critério | Resultado |
|---|---|---|---|
| `--tt-ink` (#1c1917) sobre `--tt-bg` (#fffaf5) | ~15.8:1 | 4.5:1 (texto normal) | ✅ inalterado |
| `--tt-primary-press` (#067274) sobre `--tt-primary-soft` (#e5f5f5) | 5.11:1 | 4.5:1 | ✅ passa |
| `--tt-accent-ink` (#7d2d12) sobre `--tt-accent` (#fbcdb6) | 6.43:1 | 4.5:1 | ✅ passa |
| `--tt-ink` (#1c1917) sobre `--tt-primary` (#0a9396) | 4.69:1 | 4.5:1 | ✅ passa (margem pequena) |
| `#fff` sobre `--tt-primary` (#0a9396) — **botão primário atual** | 3.73:1 | 4.5:1 (texto normal) | ⚠️ não passa |
| `--tt-primary` (#0a9396) sobre `--tt-bg` (#fffaf5) — **link de texto (ex.: "Esqueci a senha")** | 3.60:1 | 4.5:1 (texto normal) | ⚠️ não passa |

**Achado que precisa de decisão antes de promover a paleta a definitiva:** o `--tt-primary` deste teal tem luminância relativa (~31% de lightness) que não sobra margem suficiente pra 4.5:1 nem como texto branco em cima dele (botão), nem como texto colorido em cima do fundo claro (link). **Isto NÃO é uma regressão** — o laranja anterior (`#ea580c`) calculava 3.56:1 (branco no botão) e 3.43:1 (texto no fundo), no mesmo patamar — já era dívida de acessibilidade pré-existente em ambos os casos, só não tinha sido medida antes. Confirmado visualmente (screenshot da tela de login): o teal é legível na prática, mas fica no limite. Três saídas possíveis, nenhuma aplicada ainda (decisão do Matheus/cto antes de sair do teste):
1. Manter como está (aceitar a dívida, documentada, igual já era antes).
2. Escurecer levemente `--tt-primary` (reduzir lightness uns 4–6 pontos) só o suficiente pra cruzar 4.5:1 nos dois casos, sem descaracterizar o tom pedido.
3. Trocar botão primário para peso 700 (passa a valer "texto grande" a 3:1) e trocar links de `--tt-primary` para `--tt-primary-press` (mais escuro, sobra folga: 5.53:1 no fundo).

---

## 2 · Tipografia

### Famílias

| Token | Família | Uso |
|---|---|---|
| `--tt-font` | **Trip Sans** (400/500/600/700) | Toda a UI |
| `--tt-mono` | **Trip Sans Mono** (400/500) | Horários, valores monetários, IDs, números de poltrona |

**Trip Sans** e **Trip Sans Mono** são fontes de marca (não estão no Google Fonts) — os arquivos reais entregues pelo time de design são `.otf`/`.ttf` (não `.woff2`), servidos em `apps/web/public/fonts/`. A implementação efetiva (`apps/web/src/styles/fonts.css`) declara a fonte variável primeiro (cobre 100–900, resolve pesos sem arquivo estático como o 600/semibold usado em título de card e nome de lista) e depois os estáticos regular/medium/bold/ultra, que vencem nos pesos exatos 400/500/700/900 por serem declarados por último (regra do CSS Fonts Module para faixas de peso equivalentes). Trip Sans Mono só tem um arquivo estático (400) — peso 500 em mono cai na mesma face até chegar um `trip-sans-mono-medium.otf`.

```css
@font-face {
  font-family: 'Trip Sans';
  src: url('/fonts/trip-sans-variable.ttf') format('truetype-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Trip Sans';
  src: url('/fonts/trip-sans.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Trip Sans';
  src: url('/fonts/trip-sans-medium.otf') format('opentype');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Trip Sans';
  src: url('/fonts/trip-sans-bold.otf') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Trip Sans';
  src: url('/fonts/trip-sans-ultra.otf') format('opentype');
  font-weight: 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Trip Sans Mono';
  src: url('/fonts/trip-sans-mono-regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

### Escala

| Nome | Tamanho | Peso | Line-height | letter-spacing | Uso |
|---|---|---|---|---|---|
| Display | 36px | 600 | 1.1 | -0.025em | Títulos de página grande |
| Title | 22px | 600 | 1.2 | -0.015em | Cabeçalho de seção |
| Heading | 18px | 600 | 1.25 | -0.01em | Cabeçalho de card |
| Body LG | 16px | 500 | 1.4 | 0 | Nome do passageiro, valor de destaque (texto **estático**, não editável) |
| Body | 14px | 400 | 1.5 | 0 | Texto corrido |
| Input | 16px | **400** | 1.4 | 0 | Valor digitado dentro de um `<Input>` |
| Label | 12px | 600 | 1.2 | 0.04em (UPPERCASE) | Tags, badges, eyebrow |
| Mono | 14px | 500 | 1.4 | 0 | R$, horários, IDs (texto **estático**) |

### Diretrizes

- Em telas (1080 e variantes mobile), texto **nunca** abaixo de 12px. Em mobile o piso prático é 13px (corpo).
- Use `font-feature-settings: 'ss01', 'cv01'` se quiser ativar features do Trip Sans; opcional.
- Letter-spacing **negativo** apenas em ≥22px. Em texto pequeno, deixe 0.
- Acentuação portuguesa: testar `ã, õ, ç` — confirmar cobertura de glifos do Trip Sans; nunca substituir por system-ui.
- **Minimalismo tipográfico (regra geral, não só da escala acima):** peso 600/700 é para hierarquia real — títulos, CTAs, valores de destaque em modo leitura. Ele NUNCA aparece em: (a) valor digitado dentro de um input (sempre 400 — o usuário está digitando, não lendo um resultado), (b) texto corrido, (c) qualquer elemento repetido em massa numa lista (evita a tela inteira "gritando"). Na dúvida entre dois pesos, escolha o mais leve — é mais fácil aumentar peso depois numa revisão do que uma tela nascer pesada demais. Isso vale tanto para o `frontend-engineer` implementar quanto para o `code-reviewer` cobrar em revisão.

---

## 3 · Espaçamento

### Escala (múltiplos de 4)

```
4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64
```

- **Gap padrão entre seções:** 24 ou 32.
- **Gap padrão entre itens de lista:** 8 ou 10.
- **Padding interno de card:** 16 (mobile) ou 24 (desktop).
- **Padding externo da tela (mobile):** 16px.

### Alvo de toque

| Elemento | Altura mínima |
|---|---|
| Qualquer alvo clicável | **48px** |
| Botão primário em formulário | **56px** |
| Linha de lista clicável | **≥64px** |
| Input | 52px (padrão), 60px (big) |

> Use uma mão, na rua, com pressa. Toques pequenos são erros de empatia.

---

## 4 · Raio

```css
--tt-r-sm:   6px;    /* badges, chips */
--tt-r-md:   8px;    /* botões, inputs, cards — DEFAULT */
--tt-r-lg:   12px;   /* modais, sheets, hero blocks */
--tt-r-pill: 999px;  /* tags de status, FAB, filter chips */
```

**Default é 8px.** Amigável sem ser infantil. Não inflar raios — círculos completos só em pílulas e FABs.

---

## 5 · Elevação / sombra

Uso parcimonioso. A maioria das superfícies separa por borda, não por sombra.

```css
/* card padrão (sem sombra) */
border: 1px solid var(--tt-border);

/* card flutuante / sheet */
box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06);

/* FAB / CTA primário */
box-shadow: 0 4px 16px rgba(234,88,12,.35), 0 2px 4px rgba(234,88,12,.2);

/* sticky bottom action (escuro) */
box-shadow: 0 8px 24px rgba(0,0,0,.18);
```

---

## 6 · Motion

### Tokens

| Token | Duração | Easing | Uso |
|---|---|---|---|
| `fast` | 120ms | `cubic-bezier(.2,.7,.3,1)` | press, hover, ripple |
| `base` | 180ms | `cubic-bezier(.2,.7,.3,1)` | toggle, chip, badge |
| `flow` | 240ms | `cubic-bezier(.2,.7,.3,1)` | sheet, tab, page transition |
| `settle` | 320ms | `cubic-bezier(.16,1,.3,1)` | snap, drop, settle |

### Diretrizes

- Toques têm feedback visual em **≤100ms** — sempre.
- Listas usam fade + slide curto. **Nunca scale**.
- Sucessos são silenciosos: ícone + cor, sem confetti, sem modal celebrando.
- Erros usam **shake horizontal de 6px, uma vez**.
- Sem bounce. Sem easings exagerados. Motion serve feedback, não estética.

---

## 7 · Componentes

### Botão

```
height: 36 (sm) · 48 (md) · 56 (lg)
border-radius: 8
font-weight: 600
gap entre ícone e texto: 8
```

**Variantes:**

| Kind | Background | Border | Texto | Quando usar |
|---|---|---|---|---|
| `primary` | `--tt-primary` | none | `#fff` | Ação principal da tela. Apenas **uma** por tela. |
| `secondary` | `--tt-surface` | `1px --tt-border` | `--tt-ink` | Ação secundária / cancelar |
| `soft` | `--tt-primary-soft` | none | `--tt-primary-press` | Ação primária baixa-ênfase |
| `ghost` | transparent | none | `--tt-ink` | Editar inline, ações terciárias |
| `danger` | `--tt-danger` | none | `#fff` | Destruir, cancelar excursão |
| `success` | `--tt-success` | none | `#fff` | Confirmar embarque, marcar pago |

### Input

```
height: 52 (padrão) · 60 (big — formulário principal)
border-radius: 8
padding-x: 14
border: 1px solid --tt-border (ou --tt-danger se erro)
font-size: 16 (padrão) · 20 (big)
font-weight: 500
```

Estrutura:

```
[ prefix? ]  [ valor ]                          [ suffix? ]
```

- **Prefix/suffix** ficam em `--tt-mono` quando são unidades (`R$`, `BRL`).
- **Label** acima, 13px/600, cor `--tt-ink-mute`.
- **Hint/erro** abaixo, 12px, cor `--tt-ink-soft` (ou `--tt-danger`).

### Badge

```
padding: 4px 10px
border-radius: 999 (pill) ou 6 (chip)
font-size: 11.5
font-weight: 600
letter-spacing: 0.2
text-transform: UPPERCASE
```

Cores:

| Tone | Background | Texto |
|---|---|---|
| `mute` | `--tt-surface-2` + border | `--tt-ink-mute` |
| `success` | `--tt-success-soft` | `--tt-success` |
| `warning` | `--tt-warning-soft` | `--tt-warning` |
| `danger` | `--tt-danger-soft` | `--tt-danger` |
| `primary` | `--tt-primary-soft` | `--tt-primary-press` |
| `accent` | `--tt-accent` | `--tt-accent-ink` |

### Linha de lista

```
min-height: 64
padding: 14px 16px
gap: 12
border-bottom: 1px solid --tt-border-soft (exceto última)
```

Estrutura:

```
[ avatar 40x40 ]  [ nome (15/600)              ]  [ badge ]  [ chev ]
                  [ subtítulo (13, ink-mute)   ]
```

### Card de excursão

```
background: --tt-surface
border: 1px solid --tt-border
border-radius: 10
padding: 16
```

Estrutura:

```
┌──────────────────────────────────────────┐
│ [badge status]  [badge tag]      [em N dias]│  ← badges + meta
│                                          │
│ Nome do destino (19/600)                 │
│ 📅 Dom · 15 jun   ⏰ 05:30               │
│                                          │
│ 34/46 vagas              28 pagos       │
│ ▰▰▰▰▰▰▱▱▱▱                  6 pendentes │
└──────────────────────────────────────────┘
```

- **Barra de progresso:** altura 6, raio 3, cor `--tt-primary` (ou `--tt-warning` quando lotado).
- Números em `--tt-mono`.

### Bottom Navigation

```
background: --tt-surface
border-top: 1px solid --tt-border
padding: 8px 6px 22px   /* 22 inferior para safe area */
4 abas, justificadas em around
```

Por aba:

```
ícone 22px         (--tt-primary se ativo, senão --tt-mute)
label 11px / 600   (mesma cor)
fundo --tt-primary-soft quando ativo (raio 8, padding 6 14)
```

Abas: **Início · Excursões · Pagto · Mais**. Sem sidebar, sem hamburger.

### Sheet handle (bottom-sheet)

```
36 × 4, border-radius: 2
background: --tt-ink-faint
margin: top + bottom 10px, centralizada
```

### FAB / sticky action

- FAB primário: pill com texto, ícone à esquerda. Sempre `--tt-primary` com sombra de marca.
- Posição: `right: 16, bottom: 92` (acima do bottom nav).
- Sticky bottom action (lista de embarque): card preto (`--tt-ink`), padding 14 16, com ação primária à direita.

### Mapa de poltronas

| Estado | Background | Texto | Borda |
|---|---|---|---|
| `paid` | `--tt-success` | `#fff` | — |
| `pending` | `--tt-warning-soft` | `--tt-warning` | `1px --tt-warning` |
| `empty` | `--tt-surface` | `--tt-ink-mute` | `1px --tt-border` |
| `selected` | `--tt-primary` | `#fff` | — |
| `blocked` | `--tt-surface-2` + hachura 45° | `--tt-ink-soft` | `1px --tt-border` |

Dimensões: **38 × 42**, raio 6. Número em `--tt-mono`, 12/600.

Layout: 2 + corredor (18px) + 2 por linha. Frente e fundo etiquetados em `--tt-ink-soft`.

---

## 8 · UX Patterns

### Embarque (dia da viagem)

- Tap **único** no card marca embarcado.
- Verde imediato (`--tt-success-soft` no card, `--tt-success` no avatar/número).
- Horário registrado em mono ao lado da badge.
- Para desfazer: tap de novo no mesmo botão.
- KPI no topo: `N/total embarcaram`, barra de progresso laranja sobre preto.

### Cobrança PIX

- Gerar QR + chave + **mensagem pronta para WhatsApp** em uma ação.
- Webhook confirma e atualiza a linha sem refresh.
- Estado `Pendente` → `Pago` é animado (fade 240ms) — não é piscar.

### Cadastro rápido de passageiro

- Form de **4 campos** no máximo: Nome · WhatsApp · Forma de pagamento · Valor.
- Vaga **já pré-selecionada** do mapa (chip no topo).
- WhatsApp como identificador. **Sem CPF obrigatório.**
- Botão primário sticky no rodapé: "Salvar e enviar PIX".

### Mapa de vagas

- Visual = ônibus real (motorista na frente, fundo identificado).
- Cores carregam significado, legenda sempre visível.
- Toque em **livre** → cadastro rápido (vaga pré-preenchida).
- Toque em **ocupada** → ficha do passageiro.
- Quando há seleção: sticky action sheet no rodapé com número da poltrona em destaque e CTA "Adicionar".

### Busca

- Sempre por **nome OU número da poltrona**.
- Acentuação tolerante (`maria == María == MARIA`).
- Resultados em **≤200ms**.

### Feedback de ação

- **Sucesso esperado:** silencioso. Mudança visual local (cor, badge, ícone). Nada de modal.
- **Sucesso surpreendente** (ex.: PIX confirmado): toast leve no topo, 3s, dismiss tap.
- **Erro:** inline, próximo do campo/ação que falhou. Texto humano, não código.

---

## 9 · Navegação

### Estrutura

| Aba | Conteúdo |
|---|---|
| **Início** | Dashboard com 1 KPI dominante: próxima excursão e seu status. Atalho de embarque. |
| **Excursões** | Lista cronológica. Filtros: Próximas · Hoje · Concluídas · Rascunho. |
| **Pagto** | Pendentes em destaque. Cobrança em lote por WhatsApp. |
| **Mais** | Configurações, equipe, exportar, suporte. |

### App bar

- **Padrão:** altura 56, título centralizado 16/600, ícone à esquerda (voltar/menu), à direita (busca/ações).
- **Big (homes):** título 32/700, subtítulo 14 `--tt-ink-mute`. Sem centralização — alinhado à esquerda.

### Tabs

```
padding: 12px 14px
border-bottom: 2px solid (--tt-primary se ativo, transparent se não)
texto: 14/600 (--tt-ink se ativo, --tt-ink-mute se não)
```

Tabs ficam logo abaixo do hero/sumário, separadas do corpo por uma linha fina (`--tt-border`).

### Filter chips

```
height: 36
padding: 0 16
border-radius: 999
background: --tt-ink (ativo) / --tt-surface (inativo)
texto: 13/600 (#fff ativo, --tt-ink inativo)
border: none (ativo) / 1px --tt-border (inativo)
```

Linha horizontal scrollável quando passa de 4 chips.

---

## 10 · Conteúdo & tom de voz

### Princípios

- **Sempre pt-BR informal.** "Você", não "o usuário". "Embarque", não "boarding".
- **Verbo no imperativo curto** em CTAs: "Salvar e enviar PIX", "Marcar embarcado", "Adicionar passageiro".
- **Sem jargão técnico.** Diga "vaga", não "slot". "Excursão", não "evento". "Pagamento", não "transação".
- **Datas em pt-BR:** `Dom · 15 jun`. Nada de "Sunday, June 15".
- **Horários em 24h:** `05:30`, não `5:30 AM`.
- **Valores:** sempre `R$ 180,00` com vírgula decimal e ponto de milhar (`R$ 1.250,00`).

### Microcopy de status

| Em vez de | Diga |
|---|---|
| Confirmed | Pago |
| Awaiting payment | Pendente |
| Cancelled | Cancelado |
| Sold out | Lotada |
| Open / Available | Aberta |
| Draft | Rascunho |

---

## 11 · Acessibilidade

- **Contraste mínimo 4.5:1** para texto corrido. Pares testados em §1b — uma exceção conhecida e documentada (texto branco no botão primário sobre o teal, 3.73:1) segue em aberto, não é regressão da paleta anterior.
- Alvos de toque **≥48px** (visto na seção de espaçamento).
- Foco visível em todos os elementos interativos: outline de 2px sólido `--tt-primary`, offset 2px.
- Ícones decorativos: `aria-hidden="true"`. Ícones que carregam significado (status): `aria-label` claro.
- Não usar **apenas cor** para transmitir status — sempre cor + ícone ou cor + texto.

---

## 12 · Tema escuro (provisório)

Versão escura está prevista para uso noturno (embarques de madrugada), mas **não está finalizada**. Quando construir:

- Manter o caráter quente — base `oklch(0.18 0.012 60)` ou similar, não `#0a0a0a` puro.
- `--tt-primary` continua igual; o resto inverte conservadoramente.
- Sombras viram bordas (`border: 1px solid rgba(255,255,255,.08)`).

---

## 13 · Checklist de revisão

Antes de subir uma tela nova, verifique:

- [ ] Ação primária visível **sem scroll**
- [ ] Hit targets ≥48px (use o inspector)
- [ ] Apenas **um** botão primário por tela
- [ ] Cores de status acompanhadas de ícone ou texto
- [ ] Nada usa `#fff` puro como background da tela
- [ ] Letter-spacing negativo só em ≥22px
- [ ] Datas/horários/valores em `--tt-mono`
- [ ] Sem azul frio em lugar nenhum
- [ ] Animações ≤320ms, sem bounce
- [ ] Texto em pt-BR informal, sem jargão técnico
- [ ] Componentes da tabela acima — não inventar variações

---

## 14 · Referências rápidas

**Use:** Linear, Raycast, Stripe, WhatsApp Business (para tom), Airbnb (para calor).
**Evite parecer:** SAP, Salesforce, qualquer ERP, qualquer banco tradicional, qualquer SaaS "enterprise blue".

---

_Última atualização: direção visual v1 · maio/2026._
