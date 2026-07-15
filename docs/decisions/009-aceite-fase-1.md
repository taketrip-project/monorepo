# 009 — Aceite do release da Fase 1 (núcleo operacional)

> **cto** · 15/07/2026 · status: decidido

## Contexto

O QA entregou em 08/07/2026 o relatório de release da Fase 1 (`docs/qa/release-fase-1.md`, sobre o commit `068deb8`): veredito "Aprovado com ressalvas", zero bugs bloqueantes, 5 não-bloqueantes (NB-1..NB-5), multi-tenancy e UX mobile aprovados. Em 15/07/2026 os 5 NBs estão resolvidos no `main` (`2311d00` para NB-1/3/4/5; NB-2 já resolvido de carona em `bda5f95` e verificado em browser real 375×812) e todas as suítes estão verdes (lint 0/0; unit api 83/83; unit web 155/155; integração 98/98; builds ok).

## Decisão

**A Fase 1 está ACEITA e FECHADA.** Detalhes e destino das observações menores na seção "Aceite do cto" do próprio relatório.

Riscos e recortes aceitos:

- **NB-1, tolerância de 30s** para sessão revogada por rotação legítima de refresh — mesma janela que o `AuthService.refresh` já usava; logout, redefinição e remoção de membro derrubam o acesso imediatamente. Aceito.
- **CI não executado** na rodada: não bloqueia o aceite funcional, mas vira **dívida prioritária — pipeline de CI sobe antes de qualquer código da Fase 2 (dinheiro)**.
- **SES real e dispositivo físico**: checklist pré-produção + validação manual do Matheus, conforme fluxo operacional já acordado.
- Observações menores (DTO em inglês, rótulo "ABERTA" vs glossário, encoding da busca, inputs nativos) → backlog da rodada de polimento; nenhuma é bug de release.

## Consequências

- O time fica liberado para as próximas frentes: página pública H3.1/H3.2 (ADR 008), redesign das telas com os wireframes, decisão de contraste da paleta (`frontend-guidelines.md` §1b).
- A Fase 2 (PIX) continua bloqueada por duas coisas: aprovação humana do ADR 005 (provedor PIX, decisão do Matheus) e a dívida de CI acima.
- `docs/proximos-passos.md` atualizado para refletir o fecho.
