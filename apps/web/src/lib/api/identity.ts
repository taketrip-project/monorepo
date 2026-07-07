/**
 * Camada de acesso ao módulo identity (docs/api/identity.yaml): conta,
 * organização, membros, convites e autenticação. Cada função é uma chamada
 * fina sobre `apiFetch` — nada de cache ou estado aqui, isso é das telas.
 */
import { apiFetch } from './client';
import type { ApiTokens } from './types';

export interface Membro {
  id: string;
  nome: string;
  email: string;
  criado_em: string;
}

export interface Organizacao {
  id: string;
  nome: string;
  prazo_expiracao_reserva_horas: number;
  sinal_default_percentual: number;
  criado_em: string;
}

export interface Convite {
  id: string;
  email: string;
  expira_em: string;
  criado_em: string;
}

export interface SessaoIniciada {
  tokens: ApiTokens;
  membro: Membro;
  organizacao: Organizacao;
}

export interface RegistroInput {
  nome: string;
  email: string;
  senha: string;
  nome_organizacao: string;
}

export interface AceitarConviteInput {
  token: string;
  nome: string;
  senha: string;
}

export interface AtualizarOrganizacaoInput {
  nome?: string;
  prazo_expiracao_reserva_horas?: number;
  sinal_default_percentual?: number;
}

export function login(email: string, senha: string): Promise<SessaoIniciada> {
  return apiFetch<SessaoIniciada>('/auth/login', { method: 'POST', body: { email, senha }, auth: false });
}

export function registrar(input: RegistroInput): Promise<SessaoIniciada> {
  return apiFetch<SessaoIniciada>('/auth/registro', { method: 'POST', body: input, auth: false });
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}

export function esqueciSenha(email: string): Promise<void> {
  return apiFetch<void>('/auth/esqueci-senha', { method: 'POST', body: { email }, auth: false });
}

export function redefinirSenha(token: string, novaSenha: string): Promise<void> {
  return apiFetch<void>('/auth/redefinir-senha', {
    method: 'POST',
    body: { token, nova_senha: novaSenha },
    auth: false,
  });
}

export function aceitarConvite(input: AceitarConviteInput): Promise<SessaoIniciada> {
  return apiFetch<SessaoIniciada>('/auth/convites/aceitar', { method: 'POST', body: input, auth: false });
}

export function getOrganizacao(): Promise<Organizacao> {
  return apiFetch<Organizacao>('/organizacao');
}

export function atualizarOrganizacao(input: AtualizarOrganizacaoInput): Promise<Organizacao> {
  return apiFetch<Organizacao>('/organizacao', { method: 'PATCH', body: input });
}

export function listarMembros(): Promise<Membro[]> {
  return apiFetch<Membro[]>('/organizacao/membros');
}

export function removerMembro(membroId: string): Promise<void> {
  return apiFetch<void>(`/organizacao/membros/${membroId}`, { method: 'DELETE' });
}

export function listarConvites(): Promise<Convite[]> {
  return apiFetch<Convite[]>('/organizacao/convites');
}

export function criarConvite(email: string): Promise<Convite> {
  return apiFetch<Convite>('/organizacao/convites', { method: 'POST', body: { email } });
}

export function cancelarConvite(conviteId: string): Promise<void> {
  return apiFetch<void>(`/organizacao/convites/${conviteId}`, { method: 'DELETE' });
}
