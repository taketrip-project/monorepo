# 007 — Conta de passageiro, busca pública e aprovação manual

**Data:** 2026-07-14 · **Autor:** cto · **Status:** ✅ **APROVADO (versão simplificada)** — Matheus confirmou em 14/07/2026: sem conta, sem busca, reaproveitando a página pública (H3.1/H3.2). Pode andar antes do fechamento do ADR 005 (PIX), já que não depende do gate de pagamento. Próximo passo: `backend-architect` desenha o contrato técnico.

## Contexto

Matheus pediu (07/07, após validar manualmente o módulo bookings) dois papéis de uso ativo: organizador (existente) e **passageiro**, que pesquisaria excursões e escolheria forma de pagamento, com **aprovação do organizador** antes de confirmar. Como pedido, isso toca três decisões já registradas com o mesmo peso de governança ("alteração de escopo do MVP exige aprovação humana"):

1. **Conta de passageiro** contradiz o domínio modernizado: `.claude/skills/dominio-excursoes/SKILL.md` e `apps/api/.../bookings/schema.ts` fixam "Passageiro: sem conta, sem senha; WhatsApp é o identificador".
2. **Busca de excursões** é "Marketplace / descoberta pública", item explicitamente recusado em `docs/backlog.md` ("sem densidade de oferta um buscador é vazio").
3. **Aprovação manual como novo conceito** ignora que a Fase 3 (H3.1–H3.3, já no backlog) e a decisão 006 já cobrem um fluxo equivalente: reserva pública nasce `pendente`, e sem PIX configurado fica `cobranca: null` até o organizador confirmar manualmente pelo WhatsApp — ou seja, "aprovação" já existe em espírito, sem estado novo.

## Decisão

O pedido, como formulado (conta + busca + aprovação), **não avança para desenho técnico sem aprovação humana explícita**, por contradizer as três decisões acima. O cto identifica que o valor real do pedido — passageiro escolhe como vai pagar, organizador confere antes de confirmar — é entregável **sem** conta e **sem** busca, reaproveitando H3.1–H3.2 já planejados: página pública (link compartilhado pelo organizador, não buscador), passageiro escolhe forma de pagamento (`formaPagamentoEnum` já existe no schema), reserva nasce `pendente` e entra na aba Pagto (H2.5) até confirmação manual do organizador — o mesmo mecanismo que já confirma reservas feitas pelo próprio organizador (H1.10). Nenhum módulo novo, nenhum estado novo, nenhuma autenticação de passageiro.

Observação lateral: pela decisão 006, essa versão mínima **não depende do gate de PIX** (ADR 005) — funciona com `cobranca: null` desde já. Resequenciar H3.1–H3.3 antes do fechamento da Fase 2 é uma opção de priorização, não uma mudança de escopo; fica registrada aqui como opção, não decidida unilateralmente.

**Pergunta objetiva para Matheus:** *"Seu pedido de 07/07 exige duas coisas hoje fora do escopo do MVP: (1) o passageiro ter login/conta (hoje ele reserva só com nome + WhatsApp, sem senha) e (2) uma tela de busca de excursões dentro do sistema (hoje existe só o link público que você compartilha, não um buscador entre organizações). Dá pra entregar o que você quer — passageiro escolhe a forma de pagamento e você aprova antes de confirmar — sem essas duas partes, usando a página pública já planejada (H3.1/H3.2): o passageiro entra pelo link que você manda, escolhe como vai pagar, e a reserva fica pendente até você confirmar, do jeito que já funciona hoje. Serve essa versão simplificada, ou você precisa mesmo que o passageiro tenha conta própria e consiga buscar excursões dentro do app (isso vira um marketplace entre organizações, que hoje recusamos por falta de oferta)? E, se topar a versão simplificada, quer que ela ande antes de fecharmos o provedor PIX (ADR 005), já que ela funciona sem PIX?"*

## Consequências

- Sem resposta de Matheus, o backend-architect não desenha nada disso — não é escopo dele decidir o conflito de escopo.
- Se aprovada a versão simplificada: não é epic novo, é extensão de H3.1–H3.2 (Fase 3) no `docs/backlog.md`; o backend-architect desenha o "como" (contrato da página pública, campo de forma de pagamento no formulário público) a partir daí.
- Se Matheus confirmar que quer conta + busca completos: é mudança de escopo maior (nova persona autenticada, novo módulo de descoberta), reabre as decisões "sem conta" e "sem marketplace", e volta para um novo ciclo de backlog do cto antes de qualquer ADR técnico.
