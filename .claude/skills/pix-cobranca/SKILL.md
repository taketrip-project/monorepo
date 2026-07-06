---
name: pix-cobranca
description: >
  Fluxo PIX de ponta a ponta do Taketrip: cobrança dinâmica, sinal vs. integral,
  webhook idempotente, expiração, conciliação e mensagens prontas de WhatsApp.
  Use ao implementar ou testar qualquer coisa do módulo billing.
---

# Cobrança PIX — Taketrip

PIX é o meio de pagamento primário do produto (público: organizadores pequenos e passageiros brasileiros, 2026). Cartão/boleto: fora do MVP.

## Conceitos
- **Cobrança dinâmica** (cob) no provedor: QR Code + copia-e-cola, com valor e expiração. Uma cobrança por intenção de pagamento.
- **Tipos**: `sinal` (default 50%, configurável por excursão) · `integral` · `restante`.
- **txid** do provedor gravado na cobrança local — é a chave de conciliação.
- Provedores candidatos: Mercado Pago, Efí (ex-Gerencianet), Asaas. Escolha exige aprovação humana (taxas e contrato). A integração fica atrás de uma interface `PixProvider` para troca barata.

## Fluxo feliz
1. Organizador (ou passageiro na página pública) dispara cobrança → módulo billing cria `Cobranca` local `pendente` + cob no provedor → retorna QR + copia-e-cola + **mensagem pronta de WhatsApp**.
2. Passageiro paga → provedor chama webhook.
3. Webhook: valida assinatura → grava evento bruto → processa idempotente → `Cobranca.paga` → atualiza `status_pagamento` da reserva (sinal_pago ou pago) → UI atualiza sem refresh (polling curto ou SSE simples — sem WebSocket no MVP).

## Regras inegociáveis
- Centavos (inteiro) em todo o domínio. Formatação `R$ 1.250,00` só na borda de apresentação.
- **Evento bruto antes de processar**: tabela `webhook_evento` (payload JSON, txid, recebido_em, processado_em). Processamento idempotente por id de evento/txid+status.
- Fora de ordem e retries são normais: processar por estado-alvo ("esta cobrança está paga?"), não por sequência de eventos.
- Webhook de txid desconhecido: registrar + alertar, responder 200 (não fazer o provedor re-tentar para sempre), nunca crashar.
- Transições: `pendente → paga | expirada | cancelada`. Sem regressão silenciosa. Estorno = registro manual com motivo (MVP não chama API de devolução).
- Expiração da cobrança no provedor alinhada à expiração da reserva (default 48h, config da organização).
- Pagamento após expiração: reativar reserva se a poltrona segue livre; senão alertar organizador (decidir manualmente: outra poltrona ou estorno manual).

## Conciliação
Job diário (cron no Compose): lista cobranças `pendente`/`paga` dos últimos 7 dias no provedor e compara com o local. Divergência → alerta para o organizador/log de operação. Sem autocorreção silenciosa de valor.

## Mensagem pronta de WhatsApp (deep-link, sem API oficial no MVP)
`https://wa.me/55<numero>?text=<urlencode(mensagem)>`

Template (pt-BR informal, ver design system):
> Oi, {nome}! Sua vaga na excursão *{destino}* ({data}) tá guardada — poltrona {poltrona}. 😀
> Pra confirmar, é só pagar o sinal de *{valor}* no PIX abaixo (vale até {expiracao}):
> {pix_copia_e_cola}

Variações: cobrança do restante, lembrete de pendente, confirmação de pago. Sempre com valor em `R$ 0,00`, data `Dom · 15 jun`, tom de colega.

## Testes obrigatórios (billing-specialist + qa)
- Webhook duplicado → efeito único.
- Eventos fora de ordem → estado final correto.
- txid desconhecido → 200 + alerta.
- Pagamento pós-expiração → regra da poltrona aplicada.
- Conciliação com divergência plantada → alerta.
- Valor do sinal com arredondamento (ex.: 50% de R$ 179,90 = R$ 89,95 → 8995 centavos; restante fecha o total exato).
