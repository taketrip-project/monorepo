# Taketrip — Próximos Passos

> Atualizado em 15/07/2026. Este arquivo é o ponteiro operacional de "onde estamos e o que vem agora". Detalhes de cada história: `docs/backlog.md`. Quem faz o quê: `docs/ai-organization.md`. Decisões técnicas: `docs/decisions/`.

## Onde estamos

- ✅ **Fase 0 (fundação) concluída** — backlog, decisões 001–006, contratos OpenAPI (`docs/api/`)
- ✅ **Fase 1 (núcleo operacional) — FECHADA em 15/07/2026.** identity, fleet, excursions, bookings completos no `main`; QA "Aprovado com ressalvas" (`docs/qa/release-fase-1.md`), os 5 bugs não-bloqueantes corrigidos (`2311d00`, `bda5f95`), suítes 100% verdes, **aceite formal do cto registrado em `docs/decisions/009-aceite-fase-1.md`** e ao final do relatório de QA
- 🔶 **Fase 3 começou adiantada, fora de ordem**: contrato técnico da página pública pronto (H3.1/H3.2, ADR 008), implementação ainda não iniciada
- ⬜ Fase 2 — dinheiro (PIX), bloqueada por: (a) aprovação do ADR 005 pelo Matheus e (b) dívida de CI (pipeline deve subir antes de qualquer código de dinheiro — condição do aceite da fase 1)
- 🎨 **Rodada de revisão de design concluída em parte** (paleta, minimalismo, wordmark, scrollbar) — falta o redesign de layout das telas principais

## Como retomar numa sessão nova

A Fase 1 está fechada; não há pendência de release. As próximas frentes são independentes entre si (sem ordem obrigatória):

1. **Página pública da excursão (H3.1/H3.2)** — implementar a partir do ADR 008 (`docs/decisions/008-pagina-publica-contrato.md`, contrato em `docs/api/publico.yaml`): `backend-engineer` primeiro, `frontend-engineer` depois. Zero migration nova.
2. **Redesign de Home/Excursões/Detalhe** seguindo os wireframes de `assets/` (Home→Sympla, Search→Webmotors, Trip+Itinerary→Airbnb; análise na memória `project-wireframes-referencia-design`). Atenção: a seção "Itinerary" (timeline de paradas) é conceito de dado novo — passa pelo `backend-architect` antes.
3. **Decisão de contraste da paleta teal** (`frontend-guidelines.md` §1b) — pergunta rápida pro Matheus, 3 opções já documentadas.
4. **ADR 005 (provedor PIX)** — precisa da aprovação do Matheus; é o que destrava a Fase 2 junto com o CI.

Backlog de suporte (não bloqueia nenhuma frente):

- **CI (dívida prioritária)**: subir o pipeline antes de qualquer código da Fase 2.
- **Rodada de polimento** (observações menores do QA, ver "Aceite do cto" no relatório): mensagens de DTO em pt-BR, rótulo "ABERTA" vs glossário, envelope de erro na busca não-encodada, inputs nativos (valor/data) no design system.

Regras de sempre: todo PR passa pelo `code-reviewer`; decisões novas de escopo passam pelo `cto`; schema/contratos mudam só via `backend-architect`.

## Trabalho recente (07–15/07/2026)

**Fechamento da Fase 1 (15/07)**: relatório de QA commitado (`db9a53a`), fixes NB-1/3/4/5 (`2311d00`), NB-2 verificado como resolvido por `bda5f95`, aceite formal do cto (decisão 009).

**Módulo bookings** (H1.8–H1.13, backend + frontend) completo, revisado, no `main`.

**Revisão de design** (feedback de Matheus após validar bookings manualmente):
- ✅ Minimalismo tipográfico (nunca bold em valor de `<Input>`) — regra permanente em `frontend-guidelines.md`, skill `design-system-taketrip`, agentes `frontend-engineer`/`code-reviewer`
- ✅ Scrollbar oculta globalmente (scroll continua funcional)
- ✅ Wordmark de texto "taketrip" no `AppShell` e telas de auth — **ainda não existe símbolo/logo**, só texto
- ✅ Paleta teal a partir de `#0A9396` aplicada em `tokens.css` — novo agente `.claude/agents/color-theorist.md` para toda decisão de cor futura. ~~Decisão em aberto: contraste WCAG~~ → resolvida 16/07/2026 (opção 2 do §1b): primary escurecido para `#098183`, paleta promovida a definitiva
- ⬜ **Redesign de layout ainda não iniciado** (ver "Como retomar", item 2)

**Portal do passageiro** (pedido de Matheus, 07/07/2026): ADR 007 (`docs/decisions/007-conta-passageiro-busca-aprovacao.md`) — versão simplificada aprovada por Matheus (sem conta de passageiro, sem busca; reaproveita a página pública H3.1/H3.2). ADR 008 (`docs/decisions/008-pagina-publica-contrato.md`) — contrato técnico pronto (`docs/api/publico.yaml`), zero migration nova, decisão de segurança documentada (tenant resolvido via `codigo_publico`, não JWT). **Implementação não iniciada.**
