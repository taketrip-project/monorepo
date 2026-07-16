import {
  formatarPrazoHumano,
  montarInstrucoesReservaPublica,
} from './instrucoes-reserva-publica.util';

describe('formatarPrazoHumano', () => {
  it('caminho feliz: dia da semana + data + hora no fuso do Brasil (21h UTC = 18h em São Paulo)', () => {
    // 2026-12-12 é um sábado; 21:00Z = 18:00 em America/Sao_Paulo (UTC-3).
    expect(formatarPrazoHumano(new Date('2026-12-12T21:00:00.000Z'))).toBe(
      'sábado, 12/12, às 18h',
    );
  });

  it('caso de borda: minutos diferentes de zero aparecem (18h30, não 18h)', () => {
    expect(formatarPrazoHumano(new Date('2026-12-12T21:30:00.000Z'))).toBe(
      'sábado, 12/12, às 18h30',
    );
  });
});

describe('montarInstrucoesReservaPublica', () => {
  const expiraEm = new Date('2026-12-12T21:00:00.000Z');

  it('sinal: prazo em linguagem humana + combinar o sinal pelo WhatsApp', () => {
    expect(montarInstrucoesReservaPublica(expiraEm, 'sinal')).toBe(
      'Sua poltrona tá guardada até sábado, 12/12, às 18h — combine o sinal com o organizador pelo WhatsApp pra confirmar.',
    );
  });

  it('integral: fala em "o pagamento" em vez de "o sinal"', () => {
    expect(montarInstrucoesReservaPublica(expiraEm, 'integral')).toContain('combine o pagamento');
  });

  it('caso de borda: sem prazo (expira_em null, ex.: sinal já pago) não inventa data', () => {
    expect(montarInstrucoesReservaPublica(null, null)).toBe(
      'Sua poltrona tá guardada! Combine o pagamento com o organizador pelo WhatsApp pra confirmar.',
    );
  });
});
