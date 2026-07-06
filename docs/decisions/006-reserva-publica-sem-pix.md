# 006 — Reserva pública com organização sem PIX configurado

**Data:** 2026-07-06 · **Autor:** cto · **Status:** vigente

## Contexto

Tensão levantada pelo backend-architect na fase 0: H3.2 (reserva do passageiro na página pública) assume cobrança PIX, mas H2.1 define billing como aditivo — o app funciona 100% sem PIX configurado. O que acontece quando um passageiro reserva pela página pública de uma organização sem PIX? Alternativas: (a) permitir reserva com `cobranca: null` e instrução de combinar pagamento; (b) exigir PIX configurado para habilitar reserva pública.

## Decisão

**Opção (a), confirmando o contrato atual de `docs/api/publico.yaml`.** Reserva pública sem PIX configurado é criada `pendente` com `cobranca: null`; o passageiro vê instrução clara de que o organizador combinará o pagamento pelo WhatsApp; a expiração normal (default 48h) se aplica e a reserva entra na aba Pagto para cobrança manual. Publicar excursão nunca exige PIX.

O porquê: (b) bloquearia o canal de venda exatamente para o MEI que ainda não configurou credenciais — fricção que devolve o organizador à planilha e contradiz H2.1 (billing aditivo, nunca bloqueante). O modo manual da fase 1 já é um fluxo de pagamento completo e legítimo; a reserva pública sem PIX é apenas esse mesmo fluxo iniciado pelo passageiro. O risco de poltrona ocupada sem pagamento já é coberto pela regra de expiração existente — nenhuma regra nova, menos partes móveis.

## Consequências

- H3.2 ganhou critério de aceite explícito para o caso sem PIX (ver `docs/backlog.md`).
- A página pública precisa da microcopy do estado sem cobrança ("combinar pagamento pelo WhatsApp") — pt-BR informal, sem jargão.
- O qa deve testar reserva pública nos dois modos: com PIX (cobrança gerada) e sem PIX (`cobranca: null` + expiração).
