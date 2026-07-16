# 005 — Proposta de provedor PIX

**Data:** 2026-07-06 · **Autor:** backend-architect · **Status:** ✅ **APROVADO por Matheus em 2026-07-16 — Efí como provedor primário**

> **Decisão (2026-07-16):** Matheus aprovou a recomendação — **Efí**, atrás da interface `PixProvider`. Taxas marcadas como "verificar no contrato" serão confirmadas durante o onboarding real; se inverterem o custo, o runner-up (Mercado Pago) assume sem mudança de schema. O billing só inicia depois do CI no ar (condição da decisão 009).

## Contexto

O billing precisa de cobrança PIX dinâmica (QR + copia-e-cola, valor e expiração), webhook confiável e consulta para conciliação (H2.2–H2.6). Candidatos fixados no blueprint: Mercado Pago, Efí (ex-Gerencianet) e Asaas. O dinheiro cai na conta do provedor em nome da organização cliente — cada organização configura as **próprias** credenciais (`configuracao_pix`), o Taketrip não intermedia fundos (evita virar subadquirente/regulado). Taxas abaixo são faixas típicas de mercado em 2025/2026; **verificar no contrato** — mudam por negociação e volume.

## Comparativo

| Critério | Mercado Pago | Efí | Asaas |
|---|---|---|---|
| Taxa PIX típica | ~0,49–0,99% por transação (**verificar no contrato**) | ~R$ 0,01–0,45 fixo por PIX recebido via API, planos por volume (**verificar no contrato**) | ~R$ 1,99 fixo por PIX, decrescente por volume (**verificar no contrato**) |
| API | Própria (Payments/Orders), não segue o padrão Bacen; SDKs oficiais Node | **API PIX padrão Bacen** (cob/txid nativos), exatamente o modelo da skill pix-cobranca | Própria, simples, orientada a cobranças; txid exposto |
| Webhook | Webhooks/IPN com assinatura HMAC; retries documentados | Webhook do padrão Bacen com **mTLS** (skip-mTLS opcional com HMAC); retries | Webhook com token de autenticação; fila de eventos reenviáveis no painel |
| Credenciamento da organização | O mais fácil — muita agência/MEI **já tem conta MP**; OAuth para conectar conta de terceiro | Abrir conta Efí (PJ; análise em dias); certificado `.p12` por conta — onboarding mais técnico | Cadastro online rápido (PJ/MEI); aprovação em ~1 dia |
| DX | Boa, mas API genérica de pagamentos (PIX é um meio entre vários) | Docs pt-BR excelentes e específicas de PIX; mTLS complica o dev local | Docs pt-BR boas; sandbox simples |
| Risco/observações | Taxa percentual é a mais cara no ticket do produto; conta pode sofrer retenções/bloqueios de marketplace | Menor custo por transação; exige gestão de certificado por organização | Custo fixo alto em tickets baixos, ótimo em tickets altos; plataforma focada em SaaS de cobrança |

**Custo no ticket real do produto** (sinal de R$ 90 = 9000 centavos): MP ~R$ 0,44–0,89 · Efí ~centavos · Asaas ~R$ 1,99. No integral de R$ 180: MP ~R$ 0,88–1,78 · Efí ~centavos · Asaas ~R$ 1,99.

## Recomendação (do backend-architect)

**Efí como provedor primário.** Motivos: (1) API PIX padrão Bacen — o desenho do billing (cob dinâmica, txid, webhook, conciliação por listagem de cobs) mapeia 1:1, e um segundo provedor padrão Bacen no futuro seria quase drop-in; (2) menor custo por transação no ticket do produto; (3) webhook com mTLS é a autenticação mais forte dos três. **Runner-up: Mercado Pago**, se o arquiteto humano priorizar o onboarding das organizações (muitas já têm conta MP e o OAuth de conta conectada é o caminho mais curto para o organizador leigo) — o custo percentual é o preço dessa conveniência.

Independente da escolha: a integração fica atrás da interface `PixProvider` (skill pix-cobranca) com implementação única no MVP — troca barata se o contrato real decepcionar.

## Consequências

- Com Efí, o onboarding da organização (conta + certificado) é o passo mais frágil — precisa de passo a passo guiado na tela de configuração (H2.1) e validação das credenciais contra o provedor antes de ativar.
- O dev local do webhook mTLS exige o modo skip-mTLS + HMAC no ambiente de desenvolvimento; o runbook do billing-specialist deve cobrir a diferença.
- Taxas marcadas como "verificar no contrato" devem ser confirmadas por Matheus antes do gate da fase 2; se a negociação real inverter o custo, o runner-up assume sem mudança de schema (enum já contempla os três).
