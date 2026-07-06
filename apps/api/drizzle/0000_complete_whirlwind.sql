-- Extensão necessária para a busca de passageiro tolerante a acento/caixa
-- (H1.11: maria == María == MARIA). Drizzle não expressa índice funcional
-- com extensão — documentado em modules/bookings/schema.ts e adicionado
-- manualmente aqui (ver ADR 003 / skill multi-tenancy).
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE TYPE "public"."tipo_veiculo" AS ENUM('van', 'micro_onibus', 'onibus');--> statement-breakpoint
CREATE TYPE "public"."status_excursao" AS ENUM('rascunho', 'publicada', 'lotada', 'em_andamento', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."tipo_excursao" AS ENUM('bate_volta', 'pernoite');--> statement-breakpoint
CREATE TYPE "public"."tipo_sinal" AS ENUM('percentual', 'fixo');--> statement-breakpoint
CREATE TYPE "public"."forma_pagamento" AS ENUM('dinheiro', 'pix_manual', 'pix_plataforma', 'outro');--> statement-breakpoint
CREATE TYPE "public"."origem_reserva" AS ENUM('organizador', 'pagina_publica');--> statement-breakpoint
CREATE TYPE "public"."status_pagamento" AS ENUM('pendente', 'sinal_pago', 'pago', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."status_reserva" AS ENUM('ativa', 'embarcada', 'expirada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."provedor_pix" AS ENUM('mercado_pago', 'efi', 'asaas');--> statement-breakpoint
CREATE TYPE "public"."status_cobranca" AS ENUM('pendente', 'paga', 'expirada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."tipo_alerta_operacional" AS ENUM('pix_pos_expiracao_sem_vaga', 'txid_desconhecido', 'divergencia_conciliacao');--> statement-breakpoint
CREATE TYPE "public"."tipo_cobranca" AS ENUM('sinal', 'integral', 'restante');--> statement-breakpoint
CREATE TABLE "convite" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"criado_por_membro_id" uuid NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"aceito_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membro" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"tentativas_login_falhas" integer DEFAULT 0 NOT NULL,
	"bloqueado_ate" timestamp with time zone,
	"removido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizacao" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"prazo_expiracao_reserva_horas" integer DEFAULT 48 NOT NULL,
	"sinal_default_percentual" integer DEFAULT 50 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessao" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"membro_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"revogada_em" timestamp with time zone,
	"user_agent" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_redefinicao_senha" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"membro_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "veiculo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"apelido" text NOT NULL,
	"placa" text NOT NULL,
	"tipo" "tipo_veiculo" NOT NULL,
	"quantidade_poltronas" integer NOT NULL,
	"layout" jsonb NOT NULL,
	"poltronas_bloqueadas" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"excluido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "excursao" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"veiculo_id" uuid NOT NULL,
	"destino" text NOT NULL,
	"evento_ancora" text,
	"data_saida" timestamp with time zone NOT NULL,
	"data_retorno" timestamp with time zone NOT NULL,
	"tipo" "tipo_excursao" NOT NULL,
	"preco_centavos" integer NOT NULL,
	"sinal_tipo" "tipo_sinal" DEFAULT 'percentual' NOT NULL,
	"sinal_valor" integer DEFAULT 50 NOT NULL,
	"descricao" text,
	"status" "status_excursao" DEFAULT 'rascunho' NOT NULL,
	"motivo_cancelamento" text,
	"custo_total_centavos" integer,
	"codigo_publico" text NOT NULL,
	"checklist_licenca_antt" boolean DEFAULT false NOT NULL,
	"checklist_seguro_passageiros" boolean DEFAULT false NOT NULL,
	"checklist_lista_impressa" boolean DEFAULT false NOT NULL,
	"publicada_em" timestamp with time zone,
	"cancelada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foto_excursao" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"excursao_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"ordem" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ponto_embarque" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"excursao_id" uuid NOT NULL,
	"local" text NOT NULL,
	"horario" timestamp with time zone NOT NULL,
	"ordem" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passageiro" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"whatsapp" text NOT NULL,
	"cpf" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pendencia_estorno" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"reserva_id" uuid NOT NULL,
	"valor_centavos" integer NOT NULL,
	"motivo" text NOT NULL,
	"resolvida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserva" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"excursao_id" uuid NOT NULL,
	"passageiro_id" uuid NOT NULL,
	"ponto_embarque_id" uuid,
	"poltrona" integer NOT NULL,
	"status" "status_reserva" DEFAULT 'ativa' NOT NULL,
	"status_pagamento" "status_pagamento" DEFAULT 'pendente' NOT NULL,
	"origem" "origem_reserva" DEFAULT 'organizador' NOT NULL,
	"forma_pagamento" "forma_pagamento",
	"valor_centavos" integer NOT NULL,
	"expira_em" timestamp with time zone,
	"embarcada_em" timestamp with time zone,
	"cancelada_em" timestamp with time zone,
	"motivo_cancelamento" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerta_operacional" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"tipo" "tipo_alerta_operacional" NOT NULL,
	"cobranca_id" uuid,
	"reserva_id" uuid,
	"detalhes" jsonb,
	"resolvido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cobranca" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"reserva_id" uuid NOT NULL,
	"tipo" "tipo_cobranca" NOT NULL,
	"valor_centavos" integer NOT NULL,
	"status" "status_cobranca" DEFAULT 'pendente' NOT NULL,
	"provedor" "provedor_pix" NOT NULL,
	"txid" text NOT NULL,
	"copia_e_cola" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"paga_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracao_pix" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"provedor" "provedor_pix" NOT NULL,
	"chave_pix" text NOT NULL,
	"credenciais_criptografadas" text NOT NULL,
	"ativo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_evento" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provedor" "provedor_pix" NOT NULL,
	"id_evento_provedor" text,
	"txid" text,
	"payload" jsonb NOT NULL,
	"assinatura_valida" boolean NOT NULL,
	"organizacao_id" uuid,
	"cobranca_id" uuid,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"erro_processamento" text
);
--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_criado_por_membro_id_membro_id_fk" FOREIGN KEY ("criado_por_membro_id") REFERENCES "public"."membro"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro" ADD CONSTRAINT "membro_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_membro_id_membro_id_fk" FOREIGN KEY ("membro_id") REFERENCES "public"."membro"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_redefinicao_senha" ADD CONSTRAINT "token_redefinicao_senha_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_redefinicao_senha" ADD CONSTRAINT "token_redefinicao_senha_membro_id_membro_id_fk" FOREIGN KEY ("membro_id") REFERENCES "public"."membro"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veiculo" ADD CONSTRAINT "veiculo_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excursao" ADD CONSTRAINT "excursao_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excursao" ADD CONSTRAINT "excursao_veiculo_id_veiculo_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foto_excursao" ADD CONSTRAINT "foto_excursao_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foto_excursao" ADD CONSTRAINT "foto_excursao_excursao_id_excursao_id_fk" FOREIGN KEY ("excursao_id") REFERENCES "public"."excursao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ponto_embarque" ADD CONSTRAINT "ponto_embarque_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ponto_embarque" ADD CONSTRAINT "ponto_embarque_excursao_id_excursao_id_fk" FOREIGN KEY ("excursao_id") REFERENCES "public"."excursao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passageiro" ADD CONSTRAINT "passageiro_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencia_estorno" ADD CONSTRAINT "pendencia_estorno_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencia_estorno" ADD CONSTRAINT "pendencia_estorno_reserva_id_reserva_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reserva"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_excursao_id_excursao_id_fk" FOREIGN KEY ("excursao_id") REFERENCES "public"."excursao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_passageiro_id_passageiro_id_fk" FOREIGN KEY ("passageiro_id") REFERENCES "public"."passageiro"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_ponto_embarque_id_ponto_embarque_id_fk" FOREIGN KEY ("ponto_embarque_id") REFERENCES "public"."ponto_embarque"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta_operacional" ADD CONSTRAINT "alerta_operacional_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta_operacional" ADD CONSTRAINT "alerta_operacional_cobranca_id_cobranca_id_fk" FOREIGN KEY ("cobranca_id") REFERENCES "public"."cobranca"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta_operacional" ADD CONSTRAINT "alerta_operacional_reserva_id_reserva_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reserva"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobranca" ADD CONSTRAINT "cobranca_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobranca" ADD CONSTRAINT "cobranca_reserva_id_reserva_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reserva"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracao_pix" ADD CONSTRAINT "configuracao_pix_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_evento" ADD CONSTRAINT "webhook_evento_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_evento" ADD CONSTRAINT "webhook_evento_cobranca_id_cobranca_id_fk" FOREIGN KEY ("cobranca_id") REFERENCES "public"."cobranca"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "convite_token_hash_uq" ON "convite" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "convite_org_email_pendente_uq" ON "convite" USING btree ("organizacao_id","email") WHERE aceito_em IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "membro_email_uq" ON "membro" USING btree ("email") WHERE removido_em IS NULL;--> statement-breakpoint
CREATE INDEX "membro_org_idx" ON "membro" USING btree ("organizacao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessao_refresh_hash_uq" ON "sessao" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessao_org_membro_idx" ON "sessao" USING btree ("organizacao_id","membro_id");--> statement-breakpoint
CREATE UNIQUE INDEX "token_redef_hash_uq" ON "token_redefinicao_senha" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "token_redef_membro_idx" ON "token_redefinicao_senha" USING btree ("membro_id");--> statement-breakpoint
CREATE INDEX "veiculo_org_idx" ON "veiculo" USING btree ("organizacao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "veiculo_org_placa_uq" ON "veiculo" USING btree ("organizacao_id","placa") WHERE excluido_em IS NULL;--> statement-breakpoint
CREATE INDEX "excursao_org_data_idx" ON "excursao" USING btree ("organizacao_id","data_saida");--> statement-breakpoint
CREATE INDEX "excursao_org_status_idx" ON "excursao" USING btree ("organizacao_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "excursao_codigo_publico_uq" ON "excursao" USING btree ("codigo_publico");--> statement-breakpoint
CREATE INDEX "foto_excursao_org_excursao_idx" ON "foto_excursao" USING btree ("organizacao_id","excursao_id");--> statement-breakpoint
CREATE INDEX "ponto_embarque_org_excursao_idx" ON "ponto_embarque" USING btree ("organizacao_id","excursao_id","ordem");--> statement-breakpoint
CREATE UNIQUE INDEX "passageiro_org_whatsapp_uq" ON "passageiro" USING btree ("organizacao_id","whatsapp");--> statement-breakpoint
CREATE INDEX "passageiro_org_nome_idx" ON "passageiro" USING btree ("organizacao_id","nome");--> statement-breakpoint
-- `unaccent()` é STABLE (não IMMUTABLE) no PostgreSQL, então não pode ser
-- usada direto num índice; o wrapper abaixo fixa o dicionário como
-- IMMUTABLE (padrão aceito para este caso — o dicionário de acentuação não
-- muda em runtime). Ver H1.11 e comentário em modules/bookings/schema.ts.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS
$$ SELECT unaccent('unaccent', $1) $$
LANGUAGE sql IMMUTABLE PARALLEL SAFE;--> statement-breakpoint
CREATE INDEX "passageiro_org_nome_unaccent_idx" ON "passageiro" USING btree ("organizacao_id", lower(immutable_unaccent("nome")));--> statement-breakpoint
CREATE INDEX "pendencia_estorno_org_idx" ON "pendencia_estorno" USING btree ("organizacao_id") WHERE resolvida_em IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reserva_excursao_poltrona_ativa_uq" ON "reserva" USING btree ("excursao_id","poltrona") WHERE status IN ('ativa', 'embarcada');--> statement-breakpoint
CREATE INDEX "reserva_org_excursao_idx" ON "reserva" USING btree ("organizacao_id","excursao_id");--> statement-breakpoint
CREATE INDEX "reserva_org_status_pag_idx" ON "reserva" USING btree ("organizacao_id","status_pagamento");--> statement-breakpoint
CREATE INDEX "reserva_expiracao_idx" ON "reserva" USING btree ("expira_em") WHERE status = 'ativa' AND status_pagamento = 'pendente';--> statement-breakpoint
CREATE INDEX "alerta_org_aberto_idx" ON "alerta_operacional" USING btree ("organizacao_id","criado_em") WHERE resolvido_em IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cobranca_txid_uq" ON "cobranca" USING btree ("txid");--> statement-breakpoint
CREATE INDEX "cobranca_org_status_idx" ON "cobranca" USING btree ("organizacao_id","status");--> statement-breakpoint
CREATE INDEX "cobranca_reserva_idx" ON "cobranca" USING btree ("reserva_id");--> statement-breakpoint
CREATE UNIQUE INDEX "configuracao_pix_org_uq" ON "configuracao_pix" USING btree ("organizacao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_evento_provedor_id_uq" ON "webhook_evento" USING btree ("provedor","id_evento_provedor") WHERE id_evento_provedor IS NOT NULL;--> statement-breakpoint
CREATE INDEX "webhook_evento_txid_idx" ON "webhook_evento" USING btree ("txid");--> statement-breakpoint
CREATE INDEX "webhook_evento_pendente_idx" ON "webhook_evento" USING btree ("recebido_em") WHERE processado_em IS NULL AND assinatura_valida = true;