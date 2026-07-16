# 010 — LGPD no MVP: mínimo documental

> **cto** · 16/07/2026 · status: decidido (aprovação humana: Matheus, 16/07/2026)

## Contexto

Com a página pública no ar (H3.1/H3.2, commits `3c842c7`/`c17c502`), o produto passou a coletar nome, WhatsApp e CPF (opcional) direto do passageiro anônimo — antes, quem digitava era sempre o organizador. Nome + WhatsApp são dados pessoais (skill `dominio-excursoes`, obrigações legais) e `docs/ai-organization.md` reserva retenção/exclusão de dados de passageiros como decisão humana. Papéis LGPD: a **organização (organizador) é a controladora** — decide para quê os dados servem (a excursão dela); o **Taketrip é operador** — trata os dados a serviço da organização.

## Decisão

Matheus aprovou a abordagem **mínimo documental** para o MVP, em 4 partes:

1. **Página de política de privacidade** no app web, linkada a partir do formulário público. Conteúdo pronto no Anexo B — o frontend só publica.
2. **Aviso curto no formulário público de reserva**, informando que os dados vão para o organizador daquela excursão, para os fins daquela excursão. Texto pronto no Anexo A.
3. **Exclusão sob solicitação, manual**: o titular pede ao organizador (WhatsApp) e o organizador apaga pela remoção de passageiro que já existe no produto. Nenhum fluxo novo.
4. **Retenção/anonimização automática NÃO entra no MVP** — registrada como pendência pós-MVP abaixo.

## Consequências

- Frontend ganha uma tarefa pequena (backlog H3.7): página estática + 1–2 frases no formulário público. Zero backend, zero migration.
- A retenção segue indefinida na prática: dado só some quando o organizador apaga. Aceito no MVP — a lista de passageiros é também documento de fiscalização (ANTT) e o histórico tem valor operacional para o organizador.
- A política de privacidade fixa por escrito os papéis controlador/operador — isso protege o Taketrip juridicamente e precisa continuar verdadeiro: nenhum uso dos dados de passageiros pelo Taketrip fora do serviço à organização (nada de marketing, enriquecimento ou cruzamento entre tenants) sem nova decisão humana.

## Pendência pós-MVP

**Retenção/anonimização automática** (ex.: anonimizar passageiros N meses após a última excursão concluída, respeitando prazos legais de guarda). **Gatilho para reabrir:** o primeiro dos três — (a) primeira solicitação real de exclusão/dados de um titular; (b) base com passageiros de excursões concluídas há mais de 12 meses; (c) preparação para qualquer uso comercial novo dos dados. Reabrir = decisão humana (LGPD está na lista de aprovação obrigatória do Matheus).

---

## Anexo A — Aviso curto do formulário público (texto pronto)

Exibir junto ao botão de confirmar a reserva, com link para a política:

> Seus dados (nome, WhatsApp e CPF, se informar) vão direto para **{nome da organização}**, que organiza esta excursão, e servem só para a sua reserva, o contato e o embarque. Saiba mais na [Política de Privacidade](/privacidade).

Notas para o frontend: `{nome da organização}` vem do GET público da excursão; texto corrido em fonte secundária, sem checkbox de consentimento (a base legal é a execução da reserva pedida pelo próprio titular — checkbox só adiciona fricção).

## Anexo B — Página de política de privacidade (conteúdo pronto)

Rota sugerida: `/privacidade`, pública, estática.

```markdown
# Política de Privacidade — Taketrip

O Taketrip é a plataforma que organizadores de excursão usam para gerenciar
reservas, pagamentos e embarque. Esta página explica, sem juridiquês, o que
acontece com os seus dados quando você reserva uma excursão por aqui.

## Quem é responsável pelos seus dados

- **O organizador da excursão** (a agência ou pessoa que publicou a página em
  que você reservou) é o **controlador** dos seus dados: é ele quem decide
  usá-los para operar a excursão.
- **O Taketrip** é o **operador**: guarda e processa esses dados a serviço do
  organizador, e não os usa para mais nada.

## Quais dados coletamos

Ao reservar, você informa **nome**, **WhatsApp** e, se quiser, **CPF**
(opcional). Só isso.

## Para que os dados são usados

- Registrar e acompanhar a sua reserva (poltrona, pagamento, situação).
- Contato do organizador com você pelo WhatsApp (confirmação, cobrança,
  avisos de embarque).
- Lista de passageiros da viagem — documento que a fiscalização rodoviária
  (ANTT) pode exigir na estrada.

## Com quem os dados são compartilhados

- Com a **fiscalização**, quando exigido por lei (lista de passageiros).
- Com o **provedor de pagamento**, apenas o necessário para gerar a cobrança
  PIX, quando o organizador usa pagamento online.
- Com **ninguém mais**. O Taketrip não vende nem cruza seus dados, e uma
  organização nunca vê dados de passageiros de outra.

## Seus direitos e como pedir

Você pode pedir a qualquer momento para **ver, corrigir ou apagar** os seus
dados. O canal é o **WhatsApp do organizador da sua excursão** — é ele quem
atende e executa o pedido. A exclusão pode ser limitada enquanto houver
obrigação legal de guarda (por exemplo, documentos da viagem).

## Por quanto tempo guardamos

Pelo tempo necessário à excursão e às obrigações legais do organizador.
Depois disso, os dados podem ser apagados a pedido.
```
