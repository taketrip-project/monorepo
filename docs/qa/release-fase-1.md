# Relatório de release — Fase 1 (Núcleo operacional)

> **QA → cto** · 08/07/2026 · branch `main` (commit `068deb8`)
> Escopo: critérios de aceite H1.1–H1.14 de `docs/backlog.md` + regra transversal de multi-tenancy + regra transversal de UX.
> Ambiente: API + web em dev local (Node 22, PostgreSQL via docker compose), dados criados do zero via API real.

## Veredito geral

**Aprovado com ressalvas.** Nenhum bug bloqueante (fluxo crítico quebrado, dinheiro errado ou vazamento entre tenants). Os fluxos vender → operar → embarcar funcionam de ponta a ponta pela API e pela interface em 375px. Dois critérios de aceite ficaram parcialmente reprovados (H1.3 remoção de membro e H1.14 atalho de embarque) e há 5 bugs não-bloqueantes — recomendo corrigir NB-1 e NB-2 antes do release.

## Suítes automatizadas

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 0 erros (2 warnings de import não usado em `apps/api/src/modules/{excursions,identity}/schema.ts`) |
| `npm run test` (api) | ✅ 12 suítes, 78 testes |
| `npm run test` (web) | ✅ 38 arquivos, 151 testes |
| `npm run test:integration` | ✅ 9 suítes, 93 testes (inclui `multi-tenancy.integration-spec.ts` e `migrations.integration-spec.ts`) |

## Veredito por história

### H1.1 — Conta e organização · ✅ aprovado

| Critério | Veredito | Evidência |
|---|---|---|
| Cadastro com no máx. nome, e-mail, senha, nome da organização | ✅ | `POST /auth/registro` com exatamente 4 campos → 201; DTO não aceita/exige mais nada obrigatório |
| Org criada e organizador entra autenticado direto | ✅ | Resposta traz `tokens` (access 15 min + refresh) + `membro` + `organizacao` |
| E-mail duplicado → erro claro, sem vazar dados | ✅ | 409 `{"codigo":"email_ja_cadastrado","mensagem":"Já existe uma conta com este e-mail."}` — nada da conta existente é exposto |

### H1.2 — Login, sessão e recuperação de senha · ✅ aprovado

| Critério | Veredito | Evidência |
|---|---|---|
| Login e-mail + senha; sessão persiste ao reabrir navegador | ✅ | `POST /auth/login` → 200; tokens em `localStorage` (`tt_access_token`/`tt_refresh_token`), refresh opaco rotativo de 30 dias renova access expirado automaticamente (verificado: access expirado em sessão de browser continuou operando) |
| Esqueci a senha: link expira e só funciona 1 vez | ✅ | `POST /auth/esqueci-senha` → 202 (inclusive p/ e-mail inexistente — não revela contas). Redefinição: 1ª vez 204, senha antiga passa a dar 401 e a nova 200; reuso do token → 401 `token_invalido`; token com `expira_em` no passado → 401. Envio real por SES não testável em dev (sem `SES_REMETENTE`, vira log — comportamento documentado no service) |
| 5 tentativas erradas → espera progressiva | ✅ | 6ª tentativa → 429 `{"codigo":"muitas_tentativas","detalhes":{"retry_after_segundos":60}}` |

### H1.3 — Convites e membros · ⚠️ reprovado parcial (1 de 3 critérios)

| Critério | Veredito | Evidência |
|---|---|---|
| Convite por e-mail; convidado cria senha e cai na mesma org | ✅ | `POST /organizacao/convites` → 201; `POST /auth/convites/aceitar` → 201 com `organizacao.id` idêntico ao do dono; membro acessa dados da org (token do convite injetado via banco — e-mail real não sai em dev) |
| Sem papéis: todo membro pode tudo | ✅ | Membro convidado executou leitura/escrita sem restrição |
| **Membro removido perde acesso imediatamente** | ❌ **NB-1** | `DELETE /organizacao/membros/:id` → 204 revoga as sessões (refresh do removido → 401 `sessao_invalida`), **mas o access token continua válido por até 15 min**: `GET /organizacao/membros` com o token do removido → **200** logo após a remoção. O guard (`jwt-auth.guard.ts`) é 100% stateless e não confere a sessão/membro no banco |

### H1.4 — Veículos e poltronas · ✅ aprovado

| Critério | Veredito | Evidência |
|---|---|---|
| Tipos van/micro/ônibus com layout padrão gerado | ✅ | `GET /veiculos/layout-padrao`: van 15 = 1+corredor+2 (layout próprio), ônibus 46 = 2+corredor+2 (última fileira 2), micro 28 ok; todas as poltronas cobertas. Ônibus com 20 poltronas → 422 "Deve estar entre 42 e 50 para o tipo onibus." |
| Capacidade derivada, nunca digitada | ✅ | Resposta de `POST /veiculos` traz `capacidade` calculada (46); não existe campo de capacidade no DTO |
| Bloquear poltrona; bloqueada não conta como vaga | ✅ | `PATCH` com `poltronas_bloqueadas:[15]` → capacidade 15→14; reservar a poltrona bloqueada → 4xx; excursão da van fica lotada com 14 reservas |
| Editar/excluir veículo vinculado a publicada exige confirmação, sem corromper reservas | ✅ | `PATCH`/`DELETE` sem `confirmar` → 409 `veiculo_em_uso_requer_confirmacao` com mensagem clara; com `confirmar=true` → 200; reservas e mapa intactos após a edição |

### H1.5 — Excursão em rascunho · ✅ aprovado (com bug menor NB-4)

| Critério | Veredito | Evidência |
|---|---|---|
| Campos completos (destino, evento âncora, datas, tipo, veículo, preço, sinal, descrição, fotos) | ✅ | `POST /excursoes` aceita todos; sinal default 50% percentual herdado da org; `sinal_tipo:"fixo"` sem valor → 4xx; upload de foto → 201 (`POST /excursoes/:id/fotos`, storage local em dev). ⚠️ Aceita `data_retorno` anterior à `data_saida` (NB-4) |
| Nasce em `rascunho`, fora de listagem operacional e sem página pública | ✅ | `status:"rascunho"`; ausente do filtro `proximas`, presente só em `rascunho` (página pública é fase 3) |
| Preço/sinal em centavos, exibidos como `R$` | ✅ | `preco_centavos:125000` persistido; web exibe `R$ 1.250,00` (lista de passageiros) e `Sinal: R$ 625,00` (detalhe) |

### H1.6 — Pontos de embarque · ✅ aprovado

| Critério | Veredito | Evidência |
|---|---|---|
| Publicar sem ponto é bloqueado com mensagem clara | ✅ | `POST /excursoes/:id/publicar` sem pontos → 4xx `sem_ponto_embarque` "Cadastre ao menos um ponto de embarque antes de publicar a excursão." |
| Local + horário; ordem definida e preservada | ✅ | Pontos retornam com `ordem` 1,2; `PUT` de reordenação inverte e a nova ordem é preservada na listagem, na lista de embarque e na tela (setas ↑↓ na aba Pontos) |

### H1.7 — Ciclo de vida da excursão · ✅ aprovado

| Critério | Veredito | Evidência |
|---|---|---|
| Estados e transições do domínio; cancelar exige motivo | ✅ | rascunho→publicada ok; cancelar sem motivo → 4xx; com motivo → `cancelada` |
| `lotada` automática quando vagas=0 e reversão automática | ✅ | Van (14 vagas úteis) totalmente reservada → `status:"lotada"`, `vagas:0`; cancelamento de 1 reserva → volta a `publicada`, `vagas:1`, sem ação manual |
| Cancelar com pagos registra pendência de estorno | ✅ | Cancelamento com 1 reserva paga → resposta traz `pendencias_estorno:[{reserva_id, valor_centavos}]` e linha persistida na tabela `pendencia_estorno` (verificado no banco) |
| Lista cronológica com filtros Próximas · Hoje · Concluídas · Rascunho | ✅ | `GET /excursoes?filtro=...` e abas na tela Excursões |
| Card: status, destino, data/hora, X/Y vagas, pagos/pendentes | ✅ | Screenshot 375px: chip de status, destino, `Ter · 14 jul 02:30`, `5/46 vagas`, `1 pagos · 4 pendentes`, barra de progresso |

### H1.8 — Mapa de poltronas · ✅ aprovado (com ressalva de UX NB-2)

| Critério | Veredito | Evidência |
|---|---|---|
| Estados visuais + legenda sempre visível (nunca só cor) | ✅ | Mapa 375px: pago (verde + ícone ✓), pendente (âmbar + borda), livre (branco), selecionada (laranja); legenda de estados renderizada por padrão abaixo da grade (`SeatMap.tsx`); estado também é textual na lista/ficha |
| Vagas = capacidade − reservas ativas, sempre calculado | ✅ | "41 vagas livres de 46" recalculado após cada reserva/cancelamento; `vagas` não existe como coluna armazenada da excursão |
| Toque em livre abre cadastro rápido com poltrona pré-selecionada; ocupada abre ficha | ✅* | Toque seleciona a poltrona e a barra "Poltrona 8 selecionada · Adicionar" abre a sheet com chip POLTRONA 8. *A barra não fica visível sem rolagem — ver NB-2. Toque em ocupada→ficha coberto por teste de componente (`MapaPoltronasView.test.tsx`), não repetido manualmente |

### H1.9 — Cadastro rápido · ✅ aprovado

| Critério | Veredito | Evidência |
|---|---|---|
| Máx. 4 campos (Nome, WhatsApp, Forma pgto, Valor); CPF fora do fluxo rápido | ✅ | Sheet tem exatamente esses 4 campos + chip da poltrona; CPF só na ficha/API (opcional); valor default = preço da excursão (15990 confirmado) |
| Poltrona pré-selecionada; salvar cria reserva `ativa`/`pendente` | ✅ | Reserva criada pela UI e pela API: `status:"ativa"`, `status_pagamento:"pendente"`; vagas 41→40 na hora |
| **Poltrona única sob concorrência (garantia no banco)** | ✅ | 2 `POST` simultâneos na poltrona 2 → exatamente um 201 e um **409** `poltrona_ocupada` "Esta poltrona já está reservada. Escolha outra." com `detalhes.poltronas_livres` (sugestão). Constraint única no Postgres (não só na tela) |
| Mesmo WhatsApp reaproveita passageiro | ✅ | 2ª reserva com o mesmo WhatsApp → mesmo `passageiro.id`; `GET /passageiros?whatsapp=` pré-preenche (usado no `onBlur` do campo) |

### H1.10 — Pagamento manual · ✅ aprovado

| Critério | Veredito | Evidência |
|---|---|---|
| `pendente → sinal_pago → pago`; `cancelado` explícito; sem regressão silenciosa | ✅ | Transições ok; `pago → sinal_pago` → 409 "Não é possível marcar \"sinal_pago\" a partir de \"pago\"."; regressão p/ `pendente` nem existe como ação (DTO só aceita sinal_pago/pago/cancelado) |
| Marcar pago/sinal em 1 toque com mudança visual imediata | ✅ | Chips PAGO/SINAL PAGO/PENDENTE na lista mudam sem modal (testes de componente + inspeção da tela) |
| Cancelar reserva libera poltrona na hora | ✅ | Após `POST /reservas/:id/cancelar`, poltrona volta a `estado:"livre"` no mapa e `vagas` sobe na mesma leitura |

### H1.11 — Busca de passageiro · ✅ aprovado

| Critério | Veredito | Evidência |
|---|---|---|
| Tolerante a acento e caixa; busca por poltrona | ✅ | `busca=maria`, `MARIA` e `María` (percent-encoded) acham "María Açucena"; `busca=numero` acha "Passageiro Número Dois"; `busca=4` casa poltrona 4. Implementação com `lower(immutable_unaccent())` + índice funcional |
| ≤200ms com excursão cheia (50 passageiros) | ✅ | Ônibus de 50 poltronas 100% reservado; `GET /excursoes/:id/reservas?busca=...` → **18 ms** de ponta a ponta (curl) |

### H1.12 — Lista de embarque · ✅ aprovado

| Critério | Veredito | Evidência |
|---|---|---|
| Agrupada por ponto, na ordem do itinerário | ✅ | Grupos "Terminal Centro 02:00" e "Posto Trevo BR-101 02:30" na ordem dos pontos; reservas sem ponto agrupadas à parte |
| 1 toque marca `embarcada` com horário; 1 toque desfaz; feedback ≤100ms | ✅ | API: `POST /reservas/:id/embarque` → `embarcada` + `embarcada_em`; `DELETE` desfaz. UI: linha inteira é botão; atualização otimista medida em **46 ms**; desfazer volta o KPI |
| KPI `N/total embarcaram` com barra de progresso | ✅ | Card "0/6 embarcaram" com `role="progressbar"`; 0→1→0 conforme toque/desfazer |
| Opera em conexão ruim; falha de rede não apaga a tela | ✅ | Com rede cortada (offline no browser): lista permanece renderizada, toque mostra alerta "Não conseguimos atualizar o embarque agora." e o estado otimista é revertido — nada é perdido |

### H1.13 — Lista imprimível (ANTT) · ✅ aprovado

| Critério | Veredito | Evidência |
|---|---|---|
| PDF ou página de impressão com nome + documento quando informado | ✅ | `GET /excursoes/:id/lista-passageiros/impressao?formato=pdf` → 200, PDF válido (v1.3); `formato=html` → 200 com nome e CPF quando existe; botão "Imprimir lista" na aba Passageiros |
| Funciona com dados parciais (sem CPF não bloqueia) | ✅ | Passageiros sem CPF aparecem só com nome na mesma lista; geração nunca falhou |

### H1.14 — Início (dashboard) · ⚠️ reprovado parcial (1 de 2 critérios)

| Critério | Veredito | Evidência |
|---|---|---|
| 1 KPI dominante: próxima excursão com vagas/pagos/pendentes **e atalho direto para a lista de embarque** | ⚠️ **NB-3** | `GET /inicio` e a tela mostram a próxima excursão com `5/46 vagas · 1 pagos · 4 pendentes` ✅. Porém o card navega para o **detalhe** da excursão (`/excursoes/:id`, aba Detalhes) — chegar ao embarque exige mais 2 toques (Passageiros → Embarque). O "atalho direto para a lista de embarque" não existe |
| Bottom nav com 4 abas (Início · Excursões · Pagto · Mais); Pagto vazio na fase 1 | ✅ | 4 abas presentes; Pagto desabilitada/apagada ("em breve"); Mais → Organização, Veículos, Sair |

### Regra transversal — Multi-tenancy · ✅ aprovado

2 organizações reais criadas via API; com o token da org B contra os dados da org A:

| Verificação | Resultado |
|---|---|
| Listagens (excursões, veículos) | ✅ zero registros da A |
| `GET` excursão/reserva/mapa/lista-embarque/impressão da A por id | ✅ 404 em todos |
| Busca de passageiro (`?busca=`, `?whatsapp=`) | ✅ vazio/404 — passageiro da A invisível |
| Escritas: reservar na excursão da A, mudar status de pagamento de reserva da A, editar/excluir veículo da A | ✅ 404, zero efeito (dados da A conferidos intactos depois) |
| `organizacao_id` nunca vem de body/query | ✅ guard popula tenant só do JWT (`jwt-auth.guard.ts`) |

Complementado por `multi-tenancy.integration-spec.ts` (suíte verde).

### Regra transversal — UX mobile (375px) · ✅ aprovado com ressalva NB-2

Verificado com Chrome headless 375×812 (screenshots em anexo de sessão de QA): login, Início, Excursões, detalhe (Detalhes/Passageiros/Pontos), mapa, cadastro rápido, embarque, veículos, novo veículo, Mais.

- Sem scroll horizontal em nenhuma tela (scrollWidth = 375 em todas).
- Nenhum alvo de toque < 40px encontrado; poltronas e botões primários com 48px.
- Ação primária visível sem scroll: login (Entrar) ✅, cadastro rápido (Salvar reserva) ✅, Excursões (FAB Nova excursão) ✅ — **exceção: barra "Adicionar" do mapa (NB-2)**.
- Valores `R$ 1.250,00` ✅, horários 24h (`02:00`, `02:30`) ✅, microcopy pt-BR informal ✅ ("Nenhuma excursão por aí ainda, que tal criar a primeira?", "Ainda não sei").

## Bugs encontrados

### Bloqueantes

Nenhum.

### Não-bloqueantes (em ordem de prioridade)

**NB-1 · Membro removido mantém acesso por até 15 min (H1.3 — critério reprovado)**
Repro: criar convite → aceitar (guardar access token do convidado) → `DELETE /organizacao/membros/:id` (204) → repetir qualquer chamada autenticada com o access token do removido → **200** até o JWT expirar (15 min). O refresh já é revogado corretamente (401 `sessao_invalida`).
Causa: `apps/api/src/modules/identity/auth/jwt-auth.guard.ts` valida só a assinatura do JWT; nunca confere sessão/membro no banco, apesar de o token carregar `sid`.
Risco: ex-funcionário demitido em conflito opera a organização por 15 min (vê passageiros, marca pagamentos).

**NB-2 · CTA "Adicionar" do mapa fica fora da tela (regra transversal de UX em H1.8/H1.9)**
Repro (375×812): detalhe da excursão → Passageiros → Mapa → tocar poltrona livre. A barra "Poltrona N selecionada · Adicionar" (`.tt-passageiros-mapa-sticky`, `position: sticky; bottom: 8px`) não gruda no rodapé do scroller (`main.tt-app-shell-main`): medida com `getBoundingClientRect().top = 1016px` num viewport de 812px — invisível sem rolar até o fim do mapa. Viola "ação primária visível sem scroll".

**NB-3 · Início sem atalho direto para a lista de embarque (H1.14 — critério parcial)**
`apps/web/src/app/InicioPage.tsx:54` — o card navega para `/excursoes/:id` (aba Detalhes). O critério pede atalho direto para o embarque; no dia da viagem são 3 toques em vez de 1.

**NB-4 · Excursão aceita retorno anterior à saída (H1.5)**
Repro: `POST /excursoes` com `data_retorno` < `data_saida` → 201. Nenhuma validação de coerência entre as datas (o service valida outras regras; datas invertidas passam e propagam para listagens e página pública futura).

**NB-5 · `GET /health` exige autenticação**
`curl http://localhost:3333/health` → 401 `nao_autenticado`. `AppController.health()` não tem `@Public()`, então o guard global bloqueia. Docker healthcheck/CI/monitoramento não conseguem sondar a API. (O teste unitário chama o método direto e não pega o guard.)

### Menores / observações (não contam como bug de release)

- **Mensagens de validação de DTO em inglês** em alguns campos — ex.: `POST /auth/redefinir-senha` com campo errado → "nova_senha must be longer than or equal to 8 characters". Viola pt-BR informal; o envelope de erro em si está correto.
- Busca com termo acentuado enviado **sem** percent-encoding retorna 400 com corpo vazio (sem envelope `{"erro":...}`). Browsers/axios sempre encodam — só robustez de API.
- Input "Valor" do cadastro rápido usa `type=number` nativo → exibe `1250.00` (ponto, não vírgula) enquanto edita; inputs de data nativos seguem o locale do dispositivo (em en-US aparecem AM/PM). Em aparelho pt-BR o formato fica correto, mas fica registrado para o design system.
- Lint: 2 warnings de imports não usados (`sql` em excursions/schema.ts:25, `boolean` em identity/schema.ts:18).
- Card usa rótulo "ABERTA" para o estado `publicada` — conferir com o glossário do domínio se o termo de exibição está homologado.

## Fora do escopo desta verificação

- **E-mail real (SES)**: em dev sem `SES_REMETENTE` o envio vira log de aviso; conteúdo/entrega de convite e redefinição não foram validados de ponta a ponta (tokens injetados via banco para testar os fluxos).
- **CI** (item 1.0): pipeline não executado nesta rodada; suítes rodadas localmente.
- **Dispositivo físico / rede 3G real**: rede ruim simulada com offline do browser; teste em aparelho real fica para a validação do Matheus.
- **Toque em poltrona ocupada abre a ficha** e microinterações equivalentes: cobertos pelos testes de componente do web (verdes), não repetidos manualmente um a um.
- **Página pública, PIX, webhook, expiração de reserva**: fase 2/3 — nada disso foi exercitado (o campo `expira_em` da reserva existe e foi apenas observado).
- Carga além de 50 passageiros/1 organização grande; acessibilidade com leitor de tela.

## Reprodução

Scripts e evidências da rodada (fora do repositório): `e2e.sh`, `e2e2.sh`, `shots*.mjs` + screenshots 375px e logs `e2e*-evidencias.log` no scratchpad da sessão de QA. Setup usado: `.env` da raiz, `npm run db:up && npm run db:migrate && npm run db:seed`, `npm run dev`.

## Aceite do cto

> **cto** · 15/07/2026 · sobre o `main` com os fixes aplicados (commits `2311d00` e `bda5f95`)

**Decisão: ACEITO. A Fase 1 (núcleo operacional) está FECHADA.** Registro formal em `docs/decisions/009-aceite-fase-1.md`.

**Estado dos 5 não-bloqueantes** — todos resolvidos e verificados:

| # | Resolução |
|---|---|
| NB-1 | `2311d00` — guard confere sessão+membro no banco a cada request; remoção/logout/redefinição derrubam o acesso na hora. Tolerância de 30s **apenas** para sessão revogada por rotação legítima de refresh (mesma janela que o `AuthService.refresh` já usava para corrida entre abas) — **risco aceito pelo cto**: não enfraquece o caso do ex-membro. Coberto por testes unitários e de integração novos |
| NB-2 | `bda5f95` (rodada de design: shell em 100dvh, `main` como scroller real) — verificado em 15/07 em browser real 375×812: barra sticky visível sem scroll |
| NB-3 | `2311d00` — atalho no Início + deep-link `?aba=&visao=` |
| NB-4 | `2311d00` — `validarCoerenciaDatas` rejeita retorno anterior à saída |
| NB-5 | `2311d00` — `/health` com `@Public()`, teste de integração novo |

Suítes em 15/07/2026, tudo verde: lint 0 erros/0 warnings; unit api 83/83; unit web 155/155; integração 98/98; build api+web ok.

**Itens fora de escopo da verificação** — nenhum impede o fecho:

- **E-mail real (SES)**: fluxos validados com token via banco; a entrega real vira item obrigatório do checklist pré-produção (deploy em produção já exige aprovação humana por governança).
- **CI (item 1.0)**: não bloqueia o aceite funcional — suítes verdes localmente. Vira **dívida prioritária: subir o pipeline antes de qualquer código da Fase 2 (dinheiro)**.
- **Dispositivo físico / 3G real**: segue o fluxo operacional acordado — validação manual do Matheus.
- **Página pública / PIX / webhook / expiração**: fases 2/3 por definição de escopo.

**Observações menores** — viram itens de backlog da rodada de polimento (nenhuma reaberta como bug):

1. Mensagens de validação de DTO em pt-BR informal (viola regra transversal de microcopy; corrigir no polimento).
2. Rótulo "ABERTA" para o estado `publicada`: o termo **não consta no glossário do domínio**. Decidir no polimento entre alinhar a exibição ao glossário ou homologar "Aberta" no `dominio-excursoes` (tendência do cto: homologar "Aberta" — é a língua do organizador — mas só com o glossário atualizado junto).
3. Busca com termo não percent-encoded → 400 sem envelope de erro (robustez de API, baixa prioridade).
4. Input "Valor" `type=number` (ponto vs vírgula durante edição) e datas nativas dependentes do locale: registrar no design system e tratar junto do redesign das telas.
