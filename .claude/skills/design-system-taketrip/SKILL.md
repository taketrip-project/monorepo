---
name: design-system-taketrip
description: >
  Versão operacional do frontend-guidelines.md do Taketrip: tokens, componentes,
  UX patterns e checklist de revisão. Use ao construir ou revisar qualquer tela,
  componente ou microcopy. Em caso de dúvida, o frontend-guidelines.md é a fonte
  de verdade completa.
---

# Design System Taketrip — Guia Operacional

Fonte completa: `frontend-guidelines.md` (raiz do repositório). Este resumo existe para consulta rápida; não invente nada fora dele.

## Identidade em 3 princípios
1. **Rapidez** — 1–2 toques para tarefas críticas; ação primária sem scroll.
2. **Clareza** — status por cor + ícone/texto (nunca só cor).
3. **Calor** — pt-BR informal, paleta quente, tipografia humanista. Parecer um colega, não um ERP.

## Tokens essenciais
- Fundo do app: `--tt-bg` #fffaf5 (nunca #fff puro). Superfície #ffffff, borda #ece7e0.
- Primária: `--tt-primary` #ea580c (laranja) · pressed #c2410c · soft #fff1e3.
- Status: success #15803d · warning #b45309 · danger #b91c1c (cada um com `*-soft` para fundo).
- **Proibido azul** — informativo usa `--tt-ink-mute` #57534e.
- Fontes: **Trip Sans** (UI) e **Trip Sans Mono** (R$, horários, IDs, poltronas) via @font-face de `/fonts/` (arquivos em `Trip-Sans-Font.zip`). Nunca cair para system-ui.
- Raio default 8px (badges 6, sheets 12, pills 999). Espaçamento múltiplo de 4. Elevação por borda, não sombra.
- Motion: 120/180/240/320ms, `cubic-bezier(.2,.7,.3,1)`; sem bounce, sem scale em listas; erro = shake 6px 1x.

## Dimensões mínimas
Toque ≥48px · botão primário de form 56px · input 52px (big 60) · linha de lista ≥64px · texto ≥13px mobile.

## Componentes canônicos (não criar variações)
Button (primary/secondary/soft/ghost/danger/success — **um** primary por tela) · Input (label 13/600 acima, erro inline abaixo, prefixo R$ em mono) · Badge (pill, UPPERCASE 11.5/600) · ListRow (avatar 40 + nome 15/600 + subtítulo 13 + badge + chevron) · ExcursionCard (badges, destino 19/600, data/hora, barra de progresso de vagas 6px) · BottomNav (Início · Excursões · Pagto · Mais; sem sidebar/hamburger) · SeatMap (poltrona 38×42, estados paid/pending/empty/selected/blocked, 2+corredor+2) · Sheet (handle 36×4) · FAB (pill com texto, right 16 / bottom 92).

## UX patterns obrigatórios
- **Embarque**: 1 toque marca (verde imediato + horário em mono); mesmo toque desfaz; KPI `N/total` no topo.
- **Cobrança PIX**: QR + chave + mensagem pronta de WhatsApp em UMA ação; Pendente → Pago com fade 240ms sem refresh.
- **Cadastro rápido**: máx. 4 campos (Nome · WhatsApp · Forma de pagamento · Valor); poltrona pré-selecionada; CTA sticky "Salvar e enviar PIX"; **sem CPF obrigatório**.
- **Busca**: nome OU poltrona; tolerante a acento; ≤200ms.
- **Feedback**: sucesso esperado é silencioso; sucesso surpreendente = toast 3s; erro inline e humano.

## Conteúdo
pt-BR informal, imperativo curto em CTA ("Marcar embarcado"). Datas `Dom · 15 jun`, horário 24h, valores `R$ 1.250,00` em mono. Status: Pago · Pendente · Cancelado · Lotada · Aberta · Rascunho.

## Checklist antes de entregar tela (seção 13 das guidelines)
- [ ] Ação primária sem scroll — [ ] toque ≥48px — [ ] um primário por tela
- [ ] status com cor + ícone/texto — [ ] sem #fff de fundo — [ ] sem azul
- [ ] números/datas em mono — [ ] motion ≤320ms sem bounce
- [ ] pt-BR informal — [ ] só componentes canônicos — [ ] contraste ≥4.5:1 e foco visível
