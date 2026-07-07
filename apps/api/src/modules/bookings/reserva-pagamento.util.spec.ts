import { transicaoPagamentoAvanca } from './reserva-pagamento.util';

describe('transicaoPagamentoAvanca', () => {
  it('caminho feliz: avança pendente → sinal_pago → pago', () => {
    expect(transicaoPagamentoAvanca('pendente', 'sinal_pago')).toBe(true);
    expect(transicaoPagamentoAvanca('sinal_pago', 'pago')).toBe(true);
  });

  it('permite pular o sinal: pendente → pago direto', () => {
    expect(transicaoPagamentoAvanca('pendente', 'pago')).toBe(true);
  });

  it('caso de borda: nunca regride (pago → sinal_pago é inválido)', () => {
    expect(transicaoPagamentoAvanca('pago', 'sinal_pago')).toBe(false);
  });

  it('caso de borda: repetir o mesmo status não é avanço', () => {
    expect(transicaoPagamentoAvanca('sinal_pago', 'sinal_pago' as 'pago')).toBe(false);
  });

  it('caso de borda: uma vez cancelado, nenhuma transição de pagamento avança', () => {
    expect(transicaoPagamentoAvanca('cancelado', 'sinal_pago')).toBe(false);
    expect(transicaoPagamentoAvanca('cancelado', 'pago')).toBe(false);
  });
});
