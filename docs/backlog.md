# Taketrip — Backlog do MVP

> Mantido pelo **cto**. Priorizado pela ordem de execução (fase 1 → 2 → 3) de `docs/ai-organization.md`.
> Os critérios de aceite abaixo são a especificação literal que o **qa** vai usar. Terminologia obrigatória: glossário de `.claude/skills/dominio-excursoes/SKILL.md`.
> Regra transversal de UX (vale para TODA história com tela): ação primária visível sem scroll, alvos de toque ≥48px, pt-BR informal, valores como `R$ 1.250,00`, horários 24h. Checklist completo em `frontend-guidelines.md` §13.

**Regra transversal de multi-tenancy (vale para TODA história de backend):** nenhum dado de uma organização é legível ou gravável por outra. Critério de aceite permanente: teste com 2 organizações onde toda listagem, busca e escrita da org A retorna/afeta zero registros da org B.

---

## Fase 1 — Núcleo operacional

Objetivo: o organizador opera uma excursão de ponta a ponta **sem pagamento online** (marcação manual de pago — paridade com a planilha). Módulos: identity, fleet, excursions, bookings.

### 1.0 · Bootstrap do repositório

**Entrega:** monorepo único (recomendação registrada em `docs/decisions/002-monorepo.md`) com `apps/api` (NestJS) e `apps/web` (React), tooling compartilhado.

Critérios de aceite:
- [ ] Um único repositório git com `apps/api` e `apps/web`; um comando instala dependências e um comando sobe api + web em dev.
- [ ] CI executa lint, testes e build das duas apps em todo PR; PR com falha não pode ser mesclado.
- [ ] README com setup em ≤10 passos, testado do zero.
- [ ] Detalhes técnicos (versões, estrutura interna, migrations) são decisão do backend-architect — este item só fixa o formato do repositório.

### 1.1 · Identity — conta, organização e acesso

**H1.1** Como organizador, quero criar minha conta e minha organização para começar a usar o sistema.
- [ ] Cadastro pede no máximo: nome, e-mail, senha e nome da organização. Nada mais é obrigatório.
- [ ] Ao concluir, a organização (tenant) existe e o organizador entra direto no app, já autenticado.
- [ ] E-mail já cadastrado retorna erro claro em pt-BR, sem revelar dados de terceiros.

**H1.2** Como organizador, quero entrar e sair da minha conta, e recuperar a senha, para não perder acesso.
- [ ] Login com e-mail + senha; sessão persiste ao fechar e reabrir o navegador do celular.
- [ ] "Esqueci a senha" envia e-mail (SES) com link de redefinição que expira e só funciona uma vez.
- [ ] 5 tentativas de senha erradas seguidas impõem espera progressiva (proteção básica de força bruta).

**H1.3** Como organizador, quero convidar até 2 colegas para a minha organização, porque não opero sozinho na agência.
- [ ] Convite por e-mail; o convidado cria senha e cai dentro da mesma organização.
- [ ] Sem papéis/permissões no MVP: todo membro pode tudo dentro da organização (simplicidade).
- [ ] Membro removido perde acesso imediatamente (sessão invalidada).

### 1.2 · Fleet — veículos e poltronas

**H1.4** Como organizador, quero cadastrar meus veículos com layout de poltronas para controlar vagas por poltrona.
- [ ] Tipos suportados: van (15/16), micro-ônibus (24–33), ônibus (42–50); escolher o tipo gera o layout padrão (2 + corredor + 2; van tem layout próprio).
- [ ] Campos: apelido, placa, tipo, quantidade de poltronas. Capacidade é derivada do layout, nunca digitada à parte.
- [ ] Posso bloquear poltronas individuais (ex.: guia, quebrada); poltrona bloqueada não conta como vaga.
- [ ] Editar ou excluir veículo com excursão publicada vinculada exige confirmação explícita e não corrompe reservas existentes.

### 1.3 · Excursions — excursão, estados e pontos de embarque

**H1.5** Como organizador, quero criar uma excursão em rascunho com tudo que o passageiro precisa saber.
- [ ] Campos: destino, evento âncora (opcional), data/hora de saída e retorno, tipo (bate-volta | pernoite), veículo, preço, valor do sinal (default 50%, configurável por excursão: percentual ou fixo), descrição, fotos.
- [ ] Excursão nasce em `rascunho` e não aparece em nenhuma listagem operacional nem terá página pública.
- [ ] Preço e sinal são armazenados em centavos e exibidos como `R$ 180,00`.

**H1.6** Como organizador, quero definir os pontos de embarque ordenados com horário.
- [ ] Toda excursão publicada tem ≥1 ponto de embarque; publicar sem nenhum é bloqueado com mensagem clara.
- [ ] Cada ponto tem local e horário; a ordem é definida pelo organizador e preservada em toda listagem.

**H1.7** Como organizador, quero publicar, ver o ciclo de vida e cancelar excursões.
- [ ] Estados e transições exatamente como o domínio: `rascunho → publicada → lotada ⇄ publicada → em_andamento → concluida`; `cancelada` a partir de qualquer estado antes de `em_andamento`, sempre com motivo obrigatório.
- [ ] `lotada` acontece automaticamente quando vagas = 0 e reverte sozinha quando uma vaga abre.
- [ ] Cancelar excursão com reservas pagas registra a pendência de estorno (estorno em si é manual, fora do sistema).
- [ ] Lista de excursões em ordem cronológica com filtros: Próximas · Hoje · Concluídas · Rascunho.
- [ ] Card da excursão mostra: status, destino, data/hora, `X/Y vagas`, pagos e pendentes — conforme frontend-guidelines §7.

### 1.4 · Bookings — reserva, mapa de poltronas e embarque

**H1.8** Como organizador, quero ver o mapa de poltronas da excursão como um ônibus real.
- [ ] Estados visuais: livre, pendente, pago, selecionada, bloqueada — cores + legenda sempre visível (nunca só cor).
- [ ] Vagas = capacidade − reservas ativas; o número exibido é sempre calculado, nunca armazenado.
- [ ] Toque em poltrona livre abre o cadastro rápido com a poltrona pré-selecionada; toque em ocupada abre a ficha do passageiro.

**H1.9** Como organizador, quero cadastrar um passageiro em ≤4 campos, na rua, com uma mão.
- [ ] Formulário com no máximo 4 campos: Nome · WhatsApp · Forma de pagamento · Valor. CPF é opcional (campo secundário na ficha, nunca no fluxo rápido).
- [ ] Poltrona vem pré-selecionada do mapa (chip no topo); salvar cria a reserva `ativa` com pagamento `pendente`.
- [ ] **Poltrona única:** duas tentativas simultâneas na mesma poltrona → exatamente uma vence; a outra recebe erro claro e sugestão de escolher outra poltrona (garantia no banco, não só na tela).
- [ ] WhatsApp identifica o passageiro dentro da organização: recadastrar o mesmo WhatsApp reaproveita o passageiro em vez de duplicar.

**H1.10** Como organizador, quero marcar pagamentos manualmente (dinheiro, PIX por fora) para largar a planilha hoje.
- [ ] Transições manuais: `pendente → sinal_pago → pago`, e `cancelado` como ação explícita. O status nunca regride silenciosamente.
- [ ] Marcar pago/sinal é 1 toque na ficha ou na lista, com mudança visual imediata (sem modal de celebração).
- [ ] Cancelar reserva libera a poltrona na hora e some das vagas ocupadas.

**H1.11** Como organizador, quero buscar passageiro por nome ou número de poltrona.
- [ ] Busca por nome (tolerante a acento e caixa: `maria == María == MARIA`) ou por número da poltrona.
- [ ] Resultado em ≤200ms com a base de uma excursão cheia (50 passageiros).

**H1.12** Como organizador, quero a lista de embarque por ponto, com check-in de 1 toque.
- [ ] Lista agrupada por ponto de embarque, na ordem do itinerário.
- [ ] 1 toque marca `embarcada` com horário registrado; 1 toque no mesmo lugar desfaz. Feedback visual em ≤100ms.
- [ ] KPI no topo: `N/total embarcaram` com barra de progresso.
- [ ] A lista abre e opera mesmo em conexão ruim de estrada (estado carregado permanece utilizável; falha de rede não apaga a tela).

**H1.13** Como organizador, quero imprimir a lista de passageiros para a fiscalização na estrada (ANTT).
- [ ] Geração de lista imprimível (PDF ou página de impressão) com nome + documento quando informado, por excursão.
- [ ] Funciona com dados parciais: passageiro sem CPF aparece só com nome — nunca bloqueia a geração.

### 1.5 · Início (dashboard mínimo)

**H1.14** Como organizador, quero abrir o app e ver a próxima excursão e seu status em um golpe de vista.
- [ ] Aba Início mostra 1 KPI dominante: próxima excursão com vagas/pagos/pendentes e atalho direto para a lista de embarque.
- [ ] Bottom nav com 4 abas (Início · Excursões · Pagto · Mais); Pagto pode estar vazio/"em breve" na fase 1.

---

## Fase 2 — Dinheiro

Objetivo: cobrar sem correr atrás. Módulos: billing (exclusivo do billing-specialist), notifications (mensagens prontas). **Gate de entrada:** provedor PIX aprovado pelo arquiteto humano (ADR do backend-architect → aprovação de Matheus). Nada da fase 2 é implementado antes desse aval.

**H2.1** Como organizador, quero configurar minha organização para receber PIX.
- [ ] Configurações: credenciais/chave do provedor PIX, prazo de expiração de reserva pendente (default 48h), sinal default (50%).
- [ ] Sem PIX configurado, o app segue 100% funcional no modo manual da fase 1 (billing é aditivo, nunca bloqueante).

**H2.2** Como organizador, quero gerar uma cobrança PIX (sinal ou integral) em uma ação, já com a mensagem pronta de WhatsApp.
- [ ] Uma ação gera: QR Code + copia-e-cola + mensagem pronta com deep-link `wa.me` para o WhatsApp do passageiro.
- [ ] Tipos de cobrança: sinal, integral e restante (para quem pagou sinal). Valores sempre em centavos, exibidos como `R$`.
- [ ] Cobrança tem expiração e `txid` do provedor rastreável na ficha da reserva.

**H2.3** Como organizador, quero que o pagamento confirme sozinho via webhook, sem eu conferir extrato.
- [ ] Webhook confirmado atualiza `pendente → sinal_pago` ou `→ pago` conforme o tipo, e a tela reflete sem refresh (transição animada, não piscar).
- [ ] **Idempotência:** o mesmo evento de webhook entregue 2+ vezes produz exatamente 1 mudança de estado e 1 registro.
- [ ] Webhook com assinatura/origem inválida é rejeitado e registrado; nunca altera estado.
- [ ] Falha de processamento não perde o evento: há reprocessamento (cron/retry inline — sem SQS).

**H2.4** Como organizador, quero que reserva pendente expire sozinha e libere a poltrona.
- [ ] Reserva `pendente` sem sinal expira após o prazo configurado (default 48h): status vira `expirada` e a poltrona volta a ser vaga.
- [ ] PIX que chega **depois** da expiração: se a poltrona (ou outra) está livre, a reserva reativa automaticamente; se não, o organizador recebe alerta para resolver manualmente — dinheiro nunca some silenciosamente.
- [ ] Reserva com `sinal_pago` nunca expira automaticamente.

**H2.5** Como organizador, quero a aba Pagto com os pendentes em destaque para cobrar em lote.
- [ ] Pendentes primeiro, ordenados por proximidade da excursão; pagos ficam recolhidos.
- [ ] Cobrar todos os pendentes de uma excursão = uma sequência de mensagens prontas de WhatsApp (deep-link por passageiro), sem digitar nada.
- [ ] Cada linha mostra: passageiro, excursão, valor devido (sinal/restante/integral) e há quanto tempo está pendente.

**H2.6** Como organizador, quero conferir se o dinheiro que entrou bate com as reservas (conciliação).
- [ ] Visão por excursão: total previsto × total confirmado × pendente, com divergências destacadas (ex.: cobrança paga sem reserva ativa correspondente).
- [ ] Toda divergência aponta a reserva/cobrança envolvida com link direto para resolver.

**H2.7** Como organizador, quero mensagens prontas para os momentos-chave (notifications).
- [ ] Templates pt-BR informais: cobrança de sinal, cobrança do restante, confirmação de pagamento, lembrete de embarque (ponto + horário).
- [ ] Sempre deep-link `wa.me` com texto pré-preenchido — **sem** API oficial do WhatsApp no MVP.

**H2.8** Como qa, quero o runbook de incidentes de pagamento (billing-specialist).
- [ ] Runbook cobre: webhook fora do ar, pagamento duplicado, PIX pós-expiração sem vaga, divergência de conciliação — com passo a passo de resolução manual.

---

## Fase 3 — Venda e release

Objetivo: o passageiro reserva e paga sozinho pelo link; o MVP sai com suíte e2e e relatório de release.

**H3.1** Como organizador, quero um link público da excursão para colar no WhatsApp e no Instagram.
- [ ] Toda excursão `publicada` tem URL pública compartilhável; `rascunho` e `cancelada` retornam página de indisponível.
- [ ] Página mostra: destino, data/hora, tipo, pontos de embarque com horários, preço, fotos, vagas restantes — sem expor dados de nenhum passageiro.
- [ ] Abre rápido em celular 4G e tem preview decente ao colar o link no WhatsApp (título + imagem).

**H3.2** Como passageiro, quero reservar e pagar o sinal pelo link, sem criar conta.
- [ ] Fluxo: escolher poltrona livre no mapa → nome + WhatsApp (CPF opcional) → PIX do sinal ou integral → confirmação na tela. Zero criação de conta, zero senha.
- [ ] A reserva nasce `pendente` com origem `pagina_publica` e segue exatamente as mesmas regras de poltrona única e expiração das reservas do organizador.
- [ ] Excursão `lotada` desabilita a reserva na página pública na hora.
- [ ] Após reservar, o passageiro vê instruções de pagamento e o prazo de expiração em linguagem humana.
- [ ] **Organização sem PIX configurado** (decisão 006): a reserva pública continua permitida — nasce `pendente` com `cobranca: null`, o passageiro vê "o organizador vai combinar o pagamento com você pelo WhatsApp", e a expiração normal se aplica. A reserva aparece na aba Pagto para cobrança manual. Publicar excursão **nunca** exige PIX configurado.

**H3.3** Como organizador, quero saber na hora quando entra reserva pela página pública.
- [ ] Reserva de origem pública aparece nas listas e no mapa sem refresh manual (ou em ≤30s), marcada com a origem.
- [ ] Confirmação de pagamento do passageiro segue o mesmo fluxo de webhook da fase 2 (nenhum código de billing novo específico da página pública).

**H3.4** Como organizador, quero o indicador de viabilidade da excursão (informativo).
- [ ] Informo custo total (fretamento + ingressos + extras) e o sistema mostra o ponto de equilíbrio em passageiros pagos (ex.: "empata com 26 pagos").
- [ ] É indicador visual no card/detalhe — **nunca** bloqueia publicar, reservar ou cobrar.

**H3.5** Como organizador, quero o checklist legal informativo por excursão.
- [ ] Checklist por excursão: licença ANTT (fretamento eventual), seguro de passageiros, lista de passageiros impressa; CADASTUR lembrado no onboarding.
- [ ] Informar, nunca bloquear: itens desmarcados não impedem nenhuma ação.

**H3.6** Como cto, quero a suíte e2e e o relatório de release do MVP (qa).
- [ ] E2e dos fluxos críticos: criar excursão → publicar → reserva (organizador e página pública) → cobrança PIX → webhook → embarque.
- [ ] Casos de borda obrigatórios: poltrona dupla simultânea, webhook duplicado, expiração + PIX atrasado (com e sem vaga), cancelamento com pagos, isolamento entre 2 tenants.
- [ ] Relatório de release por fase: aprovado/reprovado por critério de aceite deste backlog, entregue ao cto e encaminhado ao arquiteto humano. Deploy em produção só com aprovação humana.

---

## Fora do MVP (recusado)

| Item | Justificativa (uma linha) |
|---|---|
| **Rotas recorrentes de estudantes** | Outro regime legal (fretamento contínuo ANTT) e outro ciclo de cobrança (mensal); só entra pós-MVP com demanda real medida. |
| **Marketplace / descoberta pública** | Sem densidade de oferta um buscador é vazio; a página pública compartilhável já é o canal real de venda (WhatsApp/Instagram). |
| **App React Native** | O web mobile-first cobre a operação; app nativo só quando push/offline comprovadamente limitarem o embarque. |
| Feed social, avaliações, mensagens internas | Resquício do TCC 2021; o organizador é um negócio, não um perfil social. |
| Preço escalonado (lotes) | Um preço por excursão basta para validar o MVP; lotes adicionam fricção ao cadastro. |
| Estorno automático | Dinheiro saindo automatizado é risco desproporcional; MVP registra a pendência e o estorno é manual. |
| Relatórios gerenciais genéricos | Os KPIs operacionais já vivem nas telas (pagos/pendentes, embarcados); módulo de relatório é peso morto. |
| WhatsApp API oficial | Custo e burocracia não se pagam no volume atual; deep-link `wa.me` resolve. |
| SQS / filas gerenciadas | Cron + processamento inline dão conta; fila só com sinal medido de limite. |

Qualquer tentativa de implementar itens desta seção deve ser recusada pelos agentes e devolvida ao cto.
