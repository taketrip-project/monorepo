# Taketrip — AI Organization Design

> Produzido pelo agente **AI Organization Designer** a partir de: `Taketrip.pdf` (TCC 2021), `frontend-guidelines.md` (v1, maio/2026) e premissas de negócio atualizadas (jul/2026).
> Este documento define a equipe de IA que construirá o MVP. Ele **não** é o backlog do produto — é a organização que o produzirá.

---

## 0 · Modernização do domínio (TCC 2021 → MVP 2026)

O TCC descreve um "sistema de gerenciamento de excursões" com modelo de rede social (usuário posta excursão, outro usuário entra, avalia, troca mensagens). A análise abaixo lista o que foi **mantido**, **corrigido** e **descartado**.

### Mantido (o núcleo estava certo)
- O problema real: organizadores pequenos gerenciam excursões no WhatsApp + papel/planilha.
- Entidades embrionárias: Excursão, Passageiro, Parada (→ Ponto de Embarque), Usuário (→ Organização/Membro).
- A dor validada na pesquisa do TCC: **comunicação falha** e **formas de pagamento limitadas** — seguem sendo as dores centrais em 2026.

### Corrigido
| TCC 2021 | MVP 2026 | Por quê |
|---|---|---|
| Ator único "Usuário" que cria e participa de excursões | **Organização** (tenant: agência 1–10 veículos ou MEI autônomo) com membros; **Passageiro** sem conta, identificado por WhatsApp | O organizador é um negócio, não um perfil social. Passageiro não quer criar conta para ir a um show. |
| PK `nome_usuario` VARCHAR | UUID v7 em todas as tabelas | Chave natural mutável como PK é defeito de modelagem. |
| Passageiro não pagou → removido da excursão | `status_pagamento` (pendente → sinal_pago → pago → cancelado) com **expiração configurável** da reserva | Sinal de 30–50% é a prática do mercado. Remoção imediata destrói a operação real de venda. |
| Pagamento "opcional" e sem meio definido | **PIX** como meio primário (cobrança dinâmica + webhook), sinal ou integral | PIX é ubíquo no Brasil em 2026 e resolve a dor nº 1 do organizador pequeno. |
| Sem noção de veículo ou assento | **Veículo** com layout de poltronas (van 15/16, micro 24–33, ônibus 42–50) e **mapa de poltronas** | Capacidade e poltrona são o coração da operação. Vagas = capacidade − reservas ativas (calculado, nunca armazenado). |
| "Parada" genérica | **Ponto de Embarque** ordenado com horário, dentro de um itinerário | O que o organizador precisa é a lista de embarque por ponto. |
| Administrador global mantém usuários/excursões | Sem admin global no MVP; isolamento **multi-tenant** por `organizacao_id` | O produto é SaaS B2B; cada organização só vê o que é seu. |

### Descartado (fora do MVP)
- Rede social: feed, "postar interesse em evento", mensagens internas, avaliações com estrela.
- Usuário comum virar "intermediário" de excursão de terceiros (marketplace de revenda).
- Relatórios gerenciais genéricos — o MVP tem KPIs operacionais nas telas (pagos/pendentes, embarcados), não módulo de relatório.

### Adiado (pós-MVP, mas modelado desde já como bounded context)
- **Rotas Recorrentes** (fretamento contínuo de estudantes → faculdades/escolas, com mensalidade e lista de presença). É outro regime legal (ANTT: fretamento contínuo ≠ eventual) e outro ciclo de cobrança (mensal ≠ por evento). Entra como módulo `routes` na fase de crescimento.
- Descoberta/busca pública de excursões (marketplace para o passageiro). No MVP a excursão tem **página pública compartilhável** (link no WhatsApp/Instagram — canal real de venda), não um buscador.
- App React Native. O MVP é web mobile-first (as guidelines já assumem 375px, bottom nav, uma mão).

---

## 1 · Project Blueprint

```yaml
project:
  name: Taketrip
  type: SaaS B2B multi-tenant (monólito modular) com página pública de venda
  description: >
    Sistema operacional para pequenos organizadores de excursão rodoviária no Brasil.
    Substitui WhatsApp + planilha na gestão de excursões: veículos, poltronas,
    reservas, cobrança PIX e embarque. Mobile-first, pt-BR, para uso na rua.
  users:
    - organizador_agencia: agência de turismo com 1–10 vans/micro-ônibus, 1–3 pessoas operando
    - organizador_mei: autônomo MEI com 1 van, renda extra (caravanas religiosas, shows, compras)
    - passageiro: reserva e paga via página pública compartilhada; sem conta, identificado por WhatsApp
    - transportador_estudantil: (pós-MVP) fretamento contínuo escola/faculdade com mensalidade
  modules:
    - identity: auth do organizador, organização (tenant), membros
    - fleet: veículos e layout de poltronas
    - excursions: excursão, itinerário, pontos de embarque, página pública
    - bookings: reserva, poltrona, cadastro rápido de passageiro, embarque (check-in)
    - billing: cobrança PIX (sinal/integral), webhook, expiração de reserva, conciliação
    - notifications: mensagens prontas de WhatsApp (deep-link wa.me), e-mail transacional (SES)
    - routes: (pós-MVP) rotas recorrentes de estudantes, mensalidade, presença
  integrations:
    - provedor_pix: Mercado Pago, Efí ou Asaas (decisão com aprovação humana — custo/contrato)
    - aws_ses: e-mail transacional
    - aws_s3: fotos de excursão / comprovantes
    - whatsapp: deep-link wa.me com mensagem pronta (SEM API oficial no MVP)
  risks:
    - webhook_pix: idempotência, retries, conciliação — dinheiro errado mata a confiança do organizador
    - multi_tenant: vazamento de dados entre organizações é falha terminal para um SaaS
    - usuarios_nao_tecnicos: qualquer fricção devolve o usuário para a planilha
    - concorrencia_poltrona: duas reservas simultâneas na mesma poltrona
    - lgpd: nome + WhatsApp de passageiros são dados pessoais; retenção e acesso mínimos
    - legal_transporte: ANTT (fretamento eventual), seguro, CADASTUR — MVP informa (checklist), não bloqueia
  nonFunctionalRequirements:
    - mobile_first: 375px de referência; ação primária sem scroll; toque ≥48px
    - performance: busca de passageiro ≤200ms; feedback de toque ≤100ms
    - disponibilidade: dia de embarque é crítico — lista de embarque deve abrir sempre (VPS única + backups)
    - valores_monetarios: centavos (inteiro); exibição R$ 1.250,00
    - ids: UUID v7
    - idioma: pt-BR informal em toda a UI e microcopy
  growthConsiderations:
    - routes: fretamento contínuo estudantil (mensalidade, presença) — segundo mercado, mesmo tenant
    - descoberta: buscador público de excursões quando houver densidade de oferta
    - app_react_native: quando o web mobile-first atingir limite (notificação push, offline no embarque)
    - whatsapp_api_oficial: automação de cobrança quando o volume justificar o custo
    - filas_sqs: hoje processamento inline/cron; SQS quando webhook + notificações escalarem
```

---

## 2 · Team Structure

7 agentes: os 6 agentes-base + 1 especialista (Billing). Nenhum outro especialista se justifica — notificações no MVP são deep-links e SES (skill do Backend Engineer), multi-tenancy é padrão arquitetural (skill do Backend Architect), e não há busca, realtime nem marketplace no escopo.

```yaml
agents:
  - name: cto
    responsibility: >
      Decisão de produto e escopo. Guardião da simplicidade e do domínio modernizado.
      Prioriza fases, arbitra conflitos entre agentes, corta escopo. Não escreve código.
    skills: [business-analysis, domain-modeling, documentation, dominio-excursoes]
    inputs: [docs/ai-organization.md, Taketrip.pdf, feedback do arquiteto humano]
    outputs: [decisões registradas em docs/decisions/, backlog priorizado por fase]

  - name: backend-architect
    responsibility: >
      Fronteiras dos módulos do monólito, schema PostgreSQL/Drizzle, contratos de API,
      estratégia multi-tenant e de autenticação. Decide o "como" técnico do backend.
    skills: [domain-modeling, api-design, postgresql, drizzle, security, authentication, authorization, multi-tenancy, dominio-excursoes]
    inputs: [blueprint, decisões do cto]
    outputs: [schema Drizzle, contratos de API (OpenAPI), ADRs técnicos]

  - name: backend-engineer
    responsibility: >
      Implementa os módulos NestJS (identity, fleet, excursions, bookings, notifications)
      conforme contratos do architect. Escreve testes dos próprios módulos.
    skills: [nestjs, drizzle, postgresql, testing, integrations, queues, multi-tenancy]
    inputs: [schema, contratos de API, ADRs]
    outputs: [código dos módulos, testes unitários/integração, migrations]

  - name: frontend-engineer
    responsibility: >
      Implementa o app web do organizador (React, mobile-first) e a página pública da
      excursão, seguindo estritamente o design system Taketrip. React Native só pós-MVP.
    skills: [react, react-native, design-system-taketrip, testing, dominio-excursoes]
    inputs: [contratos de API, frontend-guidelines.md]
    outputs: [telas e componentes React, testes de componente]

  - name: billing-specialist
    responsibility: >
      Tudo que toca dinheiro: integração com provedor PIX, webhook idempotente,
      sinal/integral, expiração de reserva não paga, conciliação. Único agente que
      altera o módulo billing.
    skills: [pix-cobranca, integrations, nestjs, drizzle, security, queues, testing]
    inputs: [contratos de API, decisão de provedor PIX (aprovação humana)]
    outputs: [módulo billing, testes de webhook/conciliação, runbook de incidentes de pagamento]

  - name: code-reviewer
    responsibility: >
      Revisa todo PR antes do merge: corretude, vazamento entre tenants, segurança,
      aderência ao design system e às regras de simplicidade. Não implementa.
    skills: [code-review, security, performance, multi-tenancy, design-system-taketrip]
    inputs: [pull requests]
    outputs: [revisões com achados classificados (bloqueante/sugestão)]

  - name: qa
    responsibility: >
      Planos de teste por fase, testes e2e dos fluxos críticos (reserva → PIX → embarque),
      casos de borda (poltrona dupla, webhook duplicado, expiração). Reporta ao cto.
    skills: [testing, debugging, dominio-excursoes, pix-cobranca]
    inputs: [builds aprovados pelo code-reviewer, critérios de aceite do cto]
    outputs: [suíte e2e, relatório de release por fase]
```

---

## 3 · Skill Registry

Skills padrão do catálogo (nestjs, drizzle, react, testing, etc.) são usadas como estão. Foram criadas **4 skills novas**, todas específicas do projeto e reutilizáveis entre agentes:

```yaml
skills:
  - name: dominio-excursoes
    description: >
      Domínio modernizado: personas, glossário pt-BR, entidades, regras de negócio
      (sinal, expiração, estados, ponto de equilíbrio) e obrigações legais (ANTT,
      CADASTUR, seguro). Fonte de verdade de negócio para todos os agentes.
    reusable: true
    dependencies: []

  - name: design-system-taketrip
    description: >
      Versão operacional do frontend-guidelines.md: tokens, componentes, UX patterns
      e checklist de revisão. Usada por quem constrói e por quem revisa UI.
    reusable: true
    dependencies: [frontend-guidelines.md]

  - name: multi-tenancy
    description: >
      Padrão de isolamento por organizacao_id no monólito NestJS + Drizzle: guards,
      escopo obrigatório em queries, índices compostos, checklist de revisão.
    reusable: true
    dependencies: []

  - name: pix-cobranca
    description: >
      Fluxo PIX de ponta a ponta: cobrança dinâmica, sinal vs. integral, webhook
      idempotente, expiração, conciliação e mensagens prontas de WhatsApp.
    reusable: true
    dependencies: [dominio-excursoes]
```

---

## 4 · Execution Order

```yaml
execution:
  - phase: 0-fundacao
    agents: [cto, backend-architect]
    outputs:
      - backlog do MVP por fase (cto)
      - schema Drizzle completo dos módulos do MVP (backend-architect)
      - contratos de API dos módulos identity/fleet/excursions/bookings (backend-architect)
      - ADRs: multi-tenant, auth, provedor PIX proposto (aprovação humana)

  - phase: 1-nucleo-operacional
    agents: [backend-engineer, frontend-engineer, code-reviewer]
    outputs:
      - identity + fleet + excursions + bookings funcionando
      - telas: login, lista/criação de excursão, mapa de poltronas, cadastro rápido, lista de embarque
      - reserva com poltrona sem pagamento online (marcação manual de pago — paridade com planilha)

  - phase: 2-dinheiro
    agents: [billing-specialist, backend-engineer, frontend-engineer, code-reviewer]
    outputs:
      - módulo billing: cobrança PIX, webhook, sinal, expiração de reserva
      - tela Pagto (pendentes em destaque, cobrança com mensagem pronta de WhatsApp)
      - atualização Pendente → Pago sem refresh

  - phase: 3-venda-e-release
    agents: [frontend-engineer, backend-engineer, qa, code-reviewer, cto]
    outputs:
      - página pública da excursão (link compartilhável, reserva do passageiro)
      - suíte e2e dos fluxos críticos + casos de borda
      - relatório de release do MVP (qa → cto → arquiteto humano)

  - phase: pos-mvp
    agents: [cto, backend-architect]
    outputs:
      - avaliação do módulo routes (fretamento estudantil) com dados reais de uso
```

---

## 5 · Communication Graph

```yaml
workflow:
  - from: cto
    to: backend-architect
    artifact: backlog priorizado + decisões de escopo
  - from: backend-architect
    to: backend-engineer
    artifact: schema Drizzle + contratos de API + ADRs
  - from: backend-architect
    to: billing-specialist
    artifact: contrato do módulo billing + ADR do provedor PIX
  - from: backend-architect
    to: frontend-engineer
    artifact: contratos de API (OpenAPI)
  - from: backend-engineer
    to: code-reviewer
    artifact: pull request
  - from: billing-specialist
    to: code-reviewer
    artifact: pull request
  - from: frontend-engineer
    to: code-reviewer
    artifact: pull request
  - from: code-reviewer
    to: qa
    artifact: build aprovado por fase
  - from: qa
    to: cto
    artifact: relatório de release
  - from: cto
    to: arquiteto-humano
    artifact: decisões que exigem aprovação + release do MVP
```

---

## 6 · Governance Rules

```yaml
governance:
  decidem:
    - cto: escopo, prioridade, corte de funcionalidades, critérios de aceite
    - backend-architect: schema, fronteiras de módulo, contratos, padrões técnicos de backend
    - frontend-engineer: composição de telas DENTRO do design system (fora dele, não decide)
  apenas_implementam:
    - backend-engineer
    - billing-specialist
    - qa
    - code-reviewer
  exigem_aprovacao_humana:
    - mudança de stack ou de arquitetura oficial
    - escolha/troca do provedor PIX (custo e contrato reais)
    - qualquer alteração de escopo do MVP (adicionar OU remover módulo)
    - retenção/exclusão de dados pessoais de passageiros (LGPD)
    - deploy em produção e migrations destrutivas
  criterios_de_simplicidade:
    - monólito modular; proibido microserviço, CQRS completo, event sourcing, Kubernetes
    - sem SQS enquanto cron + processamento inline derem conta
    - toda abstração nova exige justificativa escrita no PR
    - na dúvida entre 2 soluções, a com menos partes móveis vence
  criterios_de_escalabilidade:
    - módulo routes só entra com demanda real medida
    - VPS única até sinal claro de limite (latência/fila de webhook)
    - React Native só quando o web mobile-first comprovadamente limitar a operação
  regra_final: o arquiteto humano (Matheus) possui a decisão final sobre tudo.
```
