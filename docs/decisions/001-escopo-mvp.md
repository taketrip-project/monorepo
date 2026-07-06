# 001 — Escopo do MVP e ordem das fases

**Data:** 2026-07-06 · **Autor:** cto · **Status:** vigente (alterações exigem aprovação do arquiteto humano)

## Contexto

O TCC 2021 descrevia um sistema com traços de rede social (feed, avaliações, intermediários) e pagamento opcional. O domínio modernizado (`.claude/skills/dominio-excursoes/SKILL.md`) redefine o produto como SaaS B2B multi-tenant para organizadores pequenos, cujo usuário opera sozinho, no celular, na rua. As dores validadas são duas: comunicação falha e cobrança difícil. A stack (NestJS + Drizzle + PostgreSQL + React) já foi aprovada por Matheus; falta fixar o que o MVP entrega e em que ordem.

## Decisão

1. **O MVP tem exatamente 6 módulos:** identity, fleet, excursions, bookings, billing, notifications. Adicionar ou remover módulo exige aprovação humana.
2. **Ordem das fases: operação antes do dinheiro, dinheiro antes da venda.**
   - **Fase 1 (núcleo):** o organizador opera excursão completa com marcação manual de pagamento — paridade com a planilha desde o primeiro dia, sem depender do provedor PIX.
   - **Fase 2 (dinheiro):** billing PIX (cobrança, webhook idempotente, sinal, expiração) + tela Pagto. Gate: provedor PIX escolhido com aprovação humana.
   - **Fase 3 (venda e release):** página pública com reserva do passageiro (reusa billing pronto), suíte e2e e relatório de release.
3. **Recusados** (seção final do backlog): rotas recorrentes, marketplace/descoberta, React Native, feed social/avaliações, lotes de preço, estorno automático, relatórios genéricos, WhatsApp API oficial, SQS. Só voltam à mesa com dados reais de uso.

## Consequências

- A fase 1 entrega valor sozinha mesmo se a integração PIX atrasar (o modo manual segura a operação) — o maior risco externo do projeto fica isolado na fase 2.
- A página pública por último significa que o passageiro autônomo só chega no fim; aceitável porque o canal de venda real hoje é o próprio organizador no WhatsApp.
- Todo agente deve recusar trabalho da lista de recusados e devolvê-lo ao cto; o backlog (`docs/backlog.md`) é o contrato de aceite que o qa aplica literalmente.
