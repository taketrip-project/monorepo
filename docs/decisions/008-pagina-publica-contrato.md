# 008 — Contrato técnico da página pública (H3.1–H3.3)

**Data:** 2026-07-14 · **Autor:** backend-architect · **Status:** vigente

## Contexto

O ADR 007 aprovou a versão simplificada do pedido de "portal do passageiro": sem conta, sem busca, reaproveitando H3.1–H3.2 já planejados no backlog. Coube ao backend-architect desenhar o "como". `docs/api/publico.yaml` já existia desde o bootstrap do monorepo (item 1.0, fase 0) como artefato de design especulativo — nunca revisado contra o schema/services efetivamente implementados nas fases 1–2, e nunca implementado (nenhum controller/rota `@Public()` de excursão ou reserva existe hoje).

Dois achados de schema, verificados nesta revisão:
- `bookings/schema.ts` já tem `origemReservaEnum` com `'pagina_publica'` e a tabela `reserva` já aceita gravar com essa origem — **sem migration**.
- `excursions/schema.ts` já tem `codigo_publico` (UNIQUE, gerado por `codigo-publico.util.ts`, 10 chars, alfabeto de 32 símbolos sem ambíguos — ~10^15 combinações, não sequencial, não expõe o UUID interno) — **sem migration**.
- `billing/schema.ts` já tem `configuracao_pix.ativo` (1:1 por org) — a reserva pública pode checar esse flag sem migration nenhuma quando o billing-specialist implementar o serviço.

**Nenhuma migration nova é necessária para H3.1/H3.2.** O trabalho é 100% contrato + services novos/estendidos.

## O ponto delicado: organizacao_id sem JWT

`TenantContextStorage` (`common/tenant-context.ts`) é populado EXCLUSIVAMENTE pelo `JwtAuthGuard` a partir de um JWT validado — o próprio código documenta "nunca aceita organizacao_id de body/query". Rotas `@Public()` pulam o guard, então `TenantContextStorage.get()` NUNCA é preenchido nelas — qualquer código que dependa dele (e hoje **todo** método de `ExcursionsService`, `ContadorReservasService`, `PassageirosService` e `ReservasService` começa com `const ctx = TenantContextStorage.get()`) lançaria em runtime se chamado direto de uma rota pública.

**Decisão:** `TenantContextStorage` continua populado exclusivamente por JWT — nenhuma exceção, nenhum sentinel de "sessão pública". Rotas públicas resolvem `organizacao_id` de uma chave de capacidade opaca lida do próprio banco, nunca de contexto ambiente nem de payload do cliente:
- `codigo_publico` da excursão → uma linha só, `organizacao_id` vem dela.
- UUID v7 da própria `reserva` (rota `/publico/reservas/{reservaId}`) → token de posse; a linha resolvida já carrega `organizacao_id`.

Isso já tem precedente direto no código: `AuthService.redefinirSenha` (`identity/auth/auth.service.ts:262`) resolve `tokenRow` por hash de token (sem ctx) e usa `tokenRow.organizacaoId` explicitamente em cada query subsequente — nunca contexto ambiente. É o mesmo padrão, replicado para excursão/reserva pública.

**Consequência prática (o que o backend-engineer precisa mexer, não só criar):** os services de `excursions` e `bookings` hoje só sabem trabalhar com `organizacao_id` implícito via `ctx`. Para reaproveitar a MESMA lógica de negócio (poltrona única, cálculo de expiração, projeção `publicada→lotada`, reaproveitamento de passageiro por WhatsApp) sem duplicá-la para o fluxo público — duplicar é o risco real aqui, porque H3.2 exige "segue EXATAMENTE as mesmas regras" e duas implementações divergem com o tempo — é preciso extrair um núcleo que recebe `organizacaoId` **por parâmetro** em vez de ler `ctx` internamente, mantendo o método público existente como wrapper fino que passa `TenantContextStorage.get().organizacaoId`. Concretamente:

- `ExcursionsService.buscarExcursaoOuFalhar(excursaoId)` → extrai `buscarExcursaoPorOrganizacao(organizacaoId, excursaoId)`; o método existente vira wrapper de uma linha. Comportamento idêntico para todo caller autenticado — refactor mecânico, testes existentes não devem mudar.
- Novo (aditivo): `ExcursionsService.buscarExcursaoPublicaPorCodigo(codigo)` — `SELECT ... WHERE codigo_publico = codigo AND status IN ('publicada','lotada')`; sem `ctx`; 404 `excursao_indisponivel` quando não casa (mesma resposta para "não existe" e "existe mas não publicada" — sem sinal de enumeração).
- `ContadorReservasService` (usado para `vagas`/`capacidade` da página pública) → mesmo tratamento: extrair variantes com `organizacaoId` explícito.
- `PassageirosService.obterOuCriar(...)` → mesmo tratamento (é a mesma regra de "WhatsApp já cadastrado reaproveita o passageiro" do H1.9, agora acionável também pelo passageiro).
- `ReservasService.criarReserva`/`mapaPoltronas` → extrair o núcleo transacional com `organizacaoId` explícito; o método autenticado existente passa `origem: 'organizador'` (hoje implícito no default da coluna — **passar a passar explicitamente**, já que agora há dois chamadores); o novo `criarReservaPublica(codigo, dto)` resolve `organizacaoId` via `buscarExcursaoPublicaPorCodigo`, calcula `valorCentavos` no servidor (nunca aceita do corpo — ver seção de segurança) e chama o núcleo com `origem: 'pagina_publica'`.

`validarExcursaoAceitaReserva` e `validarPoltronaDoVeiculo` (`reserva-validacao.util.ts`) já são funções puras sem `ctx` — reaproveitam sem nenhuma mudança.

Este refactor toca arquivos já implementados e testados (fases 1–2). É mecânico (extração de método, mesma query, parâmetro em vez de `ctx`) e de baixo risco, mas não é puramente aditivo — o backend-engineer deve manter a suíte de testes existente verde e adicionar cobertura para os dois núcleos (autenticado e público) convergindo no mesmo caminho de código.

## Módulos: sem módulo novo

Nenhum controller público vira módulo à parte — isso adicionaria um 7º módulo à lista fechada (`identity/fleet/excursions/bookings/billing/notifications`), o que exige aprovação humana e não se justifica aqui. As rotas públicas entram nos módulos donos do dado, como um novo controller cada:
- `excursions`: novo `ExcursaoPublicaController` (`GET /publico/excursoes/{codigo}`).
- `bookings`: novo `ReservaPublicaController` (`GET .../mapa-poltronas`, `POST .../reservas`, `GET /publico/reservas/{reservaId}`) — mesma direção de dependência já estabelecida (bookings → excursions, nunca o inverso).

## Segurança — decisões explícitas

1. **Identificação pública da excursão.** `codigo_publico` (10 chars, alfabeto de 32 símbolos sem ambíguos, ~10^15 combinações) já é suficiente contra enumeração — não precisa de mudança. Reforço: 404 idêntico para "não existe" e "existe mas não publicada" (nenhuma rota pública deve responder diferente para esses dois casos).
2. **Rate limiting.** `@nestjs/throttler` (novo pacote, em memória — processo único na VPS, sem Redis; coerente com "SQS só com necessidade medida"), guard aplicado só nas rotas públicas: leituras 30/min por IP, criação de reserva 5/min por IP, consulta de situação 60/min por IP (polling da tela de confirmação). A garantia de corretude contra dupla-reserva continua sendo a UNIQUE do banco — o rate limit é só para conter abuso/ruído (bot enchendo poltronas com reservas que depois expiram), não substitui a constraint. 429 deve emitir o mesmo envelope de erro do resto da API (`MuitasTentativasException`), não o formato default do throttler.
3. **Reaproveitar validação do H1.9.** Sim, diretamente: `normalizarWhatsapp` (E.164) e os limites de `CriarReservaDto` (nome ≤120, cpf opcional) são funções/regras puras, sem `ctx` — usadas tal qual no DTO público.
4. **`valor_centavos` e `forma_pagamento` NUNCA no corpo público.** Esses campos só existem no cadastro do organizador porque o organizador é o ator confiável. No corpo público, o passageiro só escolhe `tipo_pagamento: sinal|integral`; o servidor resolve `valor_centavos` a partir de `excursao.preco_centavos`/`sinal_tipo`/`sinal_valor` (reaproveitando `resolverSinalCentavos`). Sem essa barreira, um passageiro poderia reservar por R$0,01.
5. **Cobrança PIX é opcional e não bloqueia.** A criação da reserva pública não depende de billing existir — `configuracao_pix.ativo` decide se uma cobrança é criada (chamada síncrona ao serviço público de billing quando ele existir) ou se a resposta volta com `cobranca: null` (decisão 006, já vigente, zero mudança necessária).

## Consequências

- `docs/api/publico.yaml` foi corrigido nesta revisão para bater com o schema/services reais: renomeado `vagas_restantes` → `vagas` (consistência com `ExcursaoCard`/`Excursao`/`MapaPoltronas`), removido o código de erro fictício `excursao_lotada` (o caso real é `poltrona_ocupada`, já que lotada = toda poltrona válida ocupada), adicionadas as respostas reutilizáveis `ErroIndisponivel`/`ErroNaoEncontrado`/`ErroValidacao`/`ErroMuitasTentativas` no padrão já usado em `bookings.yaml`, e documentada a resolução de tenant sem JWT e o rate limiting explicitamente na descrição do arquivo.
- O backend-engineer implementa a partir daqui: 2 controllers novos (`excursions`, `bookings`), os métodos `*PorOrganizacao`/`*PublicaPorCodigo` descritos acima, o DTO público de reserva, e o guard de rate limiting. Nenhuma migration.
- O qa cobre o caso de borda "reserva pública em excursão lotada" (deve cair em `poltrona_ocupada`, não travar em outro estado) e o isolamento entre tenants nas duas rotas de resolução por capability (`codigo_publico` e `reservaId`).
- `docs/backlog.md` (H3.1/H3.2) marcado como "contrato desenhado, aguardando implementação".
