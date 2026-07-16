import { montarPoltronaMapa, montarPoltronaMapaPublico, poltronasLivres } from './poltronas.util';

describe('montarPoltronaMapa', () => {
  it('caminho feliz: sem ocupação e sem bloqueio é livre', () => {
    expect(montarPoltronaMapa(5, false, undefined)).toEqual({
      numero: 5,
      estado: 'livre',
      reserva_id: null,
      passageiro_nome: null,
    });
  });

  it('reserva ativa reflete o status_pagamento (pendente/sinal_pago/pago)', () => {
    const base = { reservaId: 'r1', status: 'ativa' as const, passageiroNome: 'Maria' };
    expect(montarPoltronaMapa(1, false, { ...base, statusPagamento: 'pendente' }).estado).toBe(
      'pendente',
    );
    expect(montarPoltronaMapa(1, false, { ...base, statusPagamento: 'sinal_pago' }).estado).toBe(
      'sinal_pago',
    );
    expect(montarPoltronaMapa(1, false, { ...base, statusPagamento: 'pago' }).estado).toBe('pago');
  });

  it('reserva embarcada é sempre "embarcada" independente do pagamento', () => {
    const estado = montarPoltronaMapa(1, false, {
      reservaId: 'r1',
      status: 'embarcada',
      statusPagamento: 'pago',
      passageiroNome: 'Maria',
    }).estado;
    expect(estado).toBe('embarcada');
  });

  it('caso de borda: bloqueio no veículo vence qualquer ocupação', () => {
    const estado = montarPoltronaMapa(1, true, {
      reservaId: 'r1',
      status: 'ativa',
      statusPagamento: 'pago',
      passageiroNome: 'Maria',
    }).estado;
    expect(estado).toBe('bloqueada');
  });
});

describe('montarPoltronaMapaPublico', () => {
  it('caminho feliz: reduz para livre · ocupada · bloqueada, sem reserva nem nome', () => {
    expect(montarPoltronaMapaPublico(1, false, false)).toEqual({ numero: 1, estado: 'livre' });
    expect(montarPoltronaMapaPublico(2, false, true)).toEqual({ numero: 2, estado: 'ocupada' });
    expect(montarPoltronaMapaPublico(3, true, false)).toEqual({ numero: 3, estado: 'bloqueada' });
  });

  it('caso de borda: bloqueio no veículo vence qualquer ocupação (mesma prioridade do mapa do organizador)', () => {
    expect(montarPoltronaMapaPublico(4, true, true)).toEqual({ numero: 4, estado: 'bloqueada' });
  });
});

describe('poltronasLivres', () => {
  it('caminho feliz: exclui bloqueadas e ocupadas, mantém a ordem crescente', () => {
    expect(poltronasLivres(6, [3], [1, 2])).toEqual([4, 5, 6]);
  });

  it('caso de borda: respeita o limite mesmo com muitas poltronas livres', () => {
    expect(poltronasLivres(50, [], [], 3)).toEqual([1, 2, 3]);
  });
});
