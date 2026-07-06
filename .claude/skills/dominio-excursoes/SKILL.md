---
name: dominio-excursoes
description: >
  Domínio modernizado do Taketrip (2026): personas, glossário pt-BR, entidades,
  regras de negócio (sinal, expiração, estados, viabilidade) e obrigações legais
  (ANTT, CADASTUR, seguro). Fonte de verdade de negócio para todos os agentes.
  Use sempre que modelar, implementar ou testar regra de negócio.
---

# Domínio: Excursões Rodoviárias (Taketrip)

Substitui a regra de negócio do TCC 2021. Em conflito entre este documento e o PDF, este documento vence.

## Personas

| Persona | Perfil | O que precisa |
|---|---|---|
| **Agência pequena** | 1–10 vans/micro-ônibus, 1–3 pessoas operando, renda baixa/média | Parar de gerenciar no WhatsApp + planilha; cobrar sem correr atrás |
| **MEI autônomo** | 1 van, renda extra (caravana religiosa, show, compras em SP, futebol) | Simplicidade extrema; opera sozinho, no celular, na rua |
| **Passageiro** | Busca excursão porque a alternativa é inviável (passagem cara, gasolina sozinho, grupo religioso) | Achar o link, ver detalhes, reservar e pagar PIX sem criar conta |
| **Transportador estudantil** | Fretamento contínuo p/ faculdade/escola, cobrança mensal | PÓS-MVP (módulo routes) — não implementar sem decisão do cto |

## Glossário (use exatamente estes termos)

Excursão · Organizador · Passageiro · Vaga · Poltrona · Ponto de embarque · Embarque · Sinal · Pago/Pendente/Cancelado · Lotada · Rascunho · Bate-volta / Pernoite.
Proibido: slot, trip, booking (na UI), evento (para excursão), confirmed/awaiting.

## Entidades do MVP

- **Organizacao** — o tenant. Agência ou MEI. Tem membros (login), configurações (prazo de expiração de reserva, chave PIX).
- **Veiculo** — pertence à organização. Tipo (van 15/16 · micro-ônibus 24–33 · ônibus 42–50), placa, layout de poltronas (linhas 2+corredor+2 por padrão; van tem layout próprio).
- **Excursao** — destino, evento âncora opcional (show, jogo, festa religiosa), data/hora de saída e retorno, tipo (bate-volta | pernoite), veículo, preço em centavos, valor do sinal (percentual ou fixo), descrição pública, fotos.
- **PontoEmbarque** — ordenado, com local e horário. Toda excursão tem ≥1.
- **Reserva** — passageiro (nome + WhatsApp; CPF **opcional**), poltrona, status, status_pagamento, origem (organizador | página pública).
- **Cobranca** — PIX, tipo (sinal | integral | restante), valor em centavos, status, expiração, txid do provedor.

Sem conta de passageiro no MVP. WhatsApp é o identificador do passageiro dentro da organização.

## Estados

**Excursão:** `rascunho → publicada → lotada ⇄ publicada → em_andamento → concluida`; `cancelada` a partir de qualquer estado antes de em_andamento (com motivo).
**Reserva:** `ativa → embarcada | expirada | cancelada`.
**Pagamento (da reserva):** `pendente → sinal_pago → pago`; `cancelado` como transição explícita. Nunca regride silenciosamente.

## Regras de negócio

1. **Vagas** = capacidade do veículo − reservas ativas. Calculado, nunca armazenado.
2. **Poltrona única**: garantida por constraint no banco por excursão (entre reservas ativas).
3. **Sinal**: prática de mercado 30–50% do valor. Default do produto: 50%, configurável por excursão.
4. **Expiração**: reserva `pendente` (sem sinal) expira em prazo configurável pela organização (default 48h) e libera a poltrona. Substitui a regra do TCC de "remover quem não pagou" imediatamente.
5. **Pagamento pós-expiração**: se chegar PIX de reserva expirada — reativa se a poltrona (ou outra) estiver livre; senão alerta o organizador para resolver manualmente.
6. **Cancelamento pelo organizador**: exige motivo; estorno é manual no MVP (fora do sistema), o sistema registra a pendência.
7. **Viabilidade** (informativo no MVP): ponto de equilíbrio = custo total (fretamento + ingresso + extras) ÷ preço. Ex.: micro-ônibus fretado R$ 2.800 bate-volta + 30 ingressos a R$ 60 = R$ 4.600; a R$ 180/pax, empata com 26 pax. Mostrar como indicador, não bloquear.
8. **Preço escalonado (lotes)**: pós-MVP. Um preço por excursão no MVP.
9. **Embarque**: 1 toque marca embarcado com horário; 1 toque desfaz. Lista por ponto de embarque.

## Obrigações legais (MVP: informar, nunca bloquear)

- **ANTT — fretamento eventual**: viagem interestadual/turística exige licença de viagem + lista de passageiros a bordo. O sistema gera a lista de passageiros imprimível (nome + documento se informado) — é o artefato que a fiscalização pede na estrada.
- **Seguro de passageiros**: obrigatório no fretamento; checklist informativo por excursão.
- **CADASTUR**: gratuito, exigível de agentes de turismo; lembrar no onboarding.
- **MEI**: limite de faturamento e restrições de atividade — conteúdo de ajuda, não regra do sistema.
- **LGPD**: nome + WhatsApp de passageiro são dados pessoais. Coleta mínima, sem CPF obrigatório, exclusão sob demanda.

## Anti-escopo (recusar e devolver ao cto)

Feed social, avaliações com estrela, mensagens internas, "postar interesse em evento", marketplace de descoberta, revenda por intermediários, estorno automático, relatórios gerenciais genéricos, React Native, SQS.
