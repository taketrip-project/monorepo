# Taketrip — Próximos Passos

> Atualizado em 14/07/2026. Este arquivo é o ponteiro operacional de "onde estamos e o que vem agora". Detalhes de cada história: `docs/backlog.md`. Quem faz o quê: `docs/ai-organization.md`. Decisões técnicas: `docs/decisions/`.

## Onde estamos

- ✅ **Fase 0 (fundação) concluída** — backlog, decisões 001–006, contratos OpenAPI (`docs/api/`)
- ✅ **Fase 1 (núcleo operacional) — código completo.** identity, fleet, excursions, bookings: backend + frontend implementados, revisados (code-reviewer) e no `main`.
- ⚠️ **Fase 1 — fechamento formal PENDENTE, é a prioridade #1 da próxima sessão** (ver seção abaixo)
- 🔶 **Fase 3 começou adiantada, fora de ordem**: contrato técnico da página pública pronto (H3.1/H3.2), implementação ainda não iniciada
- ⬜ Fase 2 — dinheiro (PIX), bloqueada só pela aprovação do ADR 005 (não bloqueia fase 1 nem o pedaço de fase 3 já desenhado)
- 🎨 **Rodada de revisão de design concluída em parte** (paleta, minimalismo, wordmark, scrollbar) — falta o redesign de layout das telas principais

## 🚨 Prioridade #1 da próxima sessão: fechar a Fase 1

Existe um relatório de release completo em `docs/qa/release-fase-1.md` (não commitado) — veredito **"Aprovado com ressalvas"**, zero bugs bloqueantes. Encontrou 5 bugs não-bloqueantes (NB-1 a NB-5); **4 já têm fix implementado e testado no working tree, também não commitado**:

| # | Bug | Status em 14/07/2026 |
|---|---|---|
| NB-1 | Membro removido mantinha acesso por até 15min | ✅ Corrigido (`jwt-auth.guard.ts`) — **verificar efeito colateral na rotação de refresh antes de commitar**, ver `docs/qa/release-fase-1.md` e memória `divida-guard-rotacao-refresh` |
| NB-2 | CTA do mapa de poltronas fica fora da tela em 375×812 | ❌ **Não corrigido** — decidir se resolve agora ou depois |
| NB-3 | Início sem atalho direto pra embarque | ✅ Corrigido (atalho + deep-link `?aba=&visao=`) |
| NB-4 | Excursão aceita retorno anterior à saída | ✅ Corrigido (`validarCoerenciaDatas`) |
| NB-5 | `/health` exigia autenticação | ✅ Corrigido (`@Public()`) |

Passos: (1) ler `docs/qa/release-fase-1.md` inteiro, (2) decidir NB-2, (3) rodar `npm run lint/test/build` (api+web) + `npm run test:integration` (api, precisa `docker compose up -d` e migrar `taketrip`+`taketrip_test`) — **em 14/07/2026 tudo passou verde** com NB-1/3/4/5 aplicados, deve continuar assim, (4) commitar (separado do trabalho de design, são coisas diferentes) e dar push, (5) levar `docs/qa/release-fase-1.md` ao `cto` para aceite formal e fechar a fase.

Há também um arquivo vazio espúrio `Untitled` na raiz do repo — provavelmente sobra de editor, seguro de apagar, mas confirme antes.

## Trabalho recente (07–14/07/2026)

**Módulo bookings** (H1.8–H1.13, backend + frontend) completo, revisado, no `main`.

**Revisão de design** (feedback de Matheus após validar bookings manualmente):
- ✅ Minimalismo tipográfico (nunca bold em valor de `<Input>`) — regra permanente em `frontend-guidelines.md`, skill `design-system-taketrip`, agentes `frontend-engineer`/`code-reviewer`
- ✅ Scrollbar oculta globalmente (scroll continua funcional)
- ✅ Wordmark de texto "taketrip" no `AppShell` e telas de auth — **ainda não existe símbolo/logo**, só texto
- ✅ Paleta teal a partir de `#0A9396` aplicada em `tokens.css` — novo agente `.claude/agents/color-theorist.md` criado para toda decisão de cor futura. Decisão em aberto (não bloqueante): contraste WCAG do texto branco no botão primário e do link de auth ficou abaixo do ideal (mesmo patamar do laranja anterior, não é regressão) — 3 opções documentadas em `frontend-guidelines.md` §1b, ninguém escolheu ainda
- ⬜ **Redesign de layout ainda não iniciado**: wireframes de referência em `assets/` (`Home.png`→Sympla, `Search.png`→Webmotors, `Trip.png`+`Itinerary.png`→Airbnb, análise completa em memória `project-wireframes-referencia-design`) mostram uma composição bem diferente da atual pras telas Início/Excursões/Detalhe. Achado importante: a seção "Itinerary" (timeline vertical de paradas) é conceito de dado NOVO — não existe no schema hoje (só `ponto_embarque`, que é embarque, não parada de viagem). Precisa passar pelo `backend-architect` antes de implementar essa parte específica.

**Portal do passageiro** (pedido de Matheus, 07/07/2026): ADR 007 (`docs/decisions/007-conta-passageiro-busca-aprovacao.md`) — versão simplificada aprovada por Matheus (sem conta de passageiro, sem busca; reaproveita a página pública H3.1/H3.2). ADR 008 (`docs/decisions/008-pagina-publica-contrato.md`) — contrato técnico pronto (`docs/api/publico.yaml`), zero migration nova, decisão de segurança documentada (tenant resolvido via `codigo_publico`, não JWT). **Implementação não iniciada.**

## Como retomar numa sessão nova

1. **Primeiro**: ler `docs/qa/release-fase-1.md` e a memória `project-qa-fase1-pendencias` — resolver NB-2, commitar o resto, fechar a Fase 1 com o `cto`.
2. **Depois, escolher entre** (não há ordem obrigatória, são independentes):
   - Redesign de Home/Excursões/Detalhe seguindo os wireframes de `assets/` (design system já com a paleta nova pronta pra usar)
   - Implementar a página pública da excursão (H3.1/H3.2) a partir do ADR 008 — `backend-engineer` primeiro, `frontend-engineer` depois
   - Resolver a decisão de contraste da paleta teal (`frontend-guidelines.md` §1b) — pergunta rápida pro Matheus
3. Todo PR passa pelo `code-reviewer`. Decisões novas de escopo passam pelo `cto`; schema/contratos mudam só via `backend-architect`.
