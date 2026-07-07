import { normalizarWhatsapp } from './whatsapp.util';

describe('normalizarWhatsapp', () => {
  it('caminho feliz: DDD + celular sem código do país ganha o prefixo 55', () => {
    expect(normalizarWhatsapp('11999998888')).toBe('5511999998888');
  });

  it('aceita formatação humana (parênteses, espaço, hífen)', () => {
    expect(normalizarWhatsapp('(11) 99999-8888')).toBe('5511999998888');
  });

  it('já com código do país (com ou sem +) é preservado', () => {
    expect(normalizarWhatsapp('+55 11 99999-8888')).toBe('5511999998888');
    expect(normalizarWhatsapp('5511999998888')).toBe('5511999998888');
  });

  it('DDD + fixo (10 dígitos) também ganha o prefixo 55', () => {
    expect(normalizarWhatsapp('1133334444')).toBe('551133334444');
  });

  it('caso de borda: número curto demais (sem DDD) é rejeitado com 422 validacao', () => {
    expect(() => normalizarWhatsapp('999998888')).toThrow();
    try {
      normalizarWhatsapp('999998888');
      fail('deveria ter lançado');
    } catch (erro) {
      const resposta = (erro as { getResponse: () => { erro: { codigo: string } } }).getResponse();
      expect(resposta.erro.codigo).toBe('validacao');
    }
  });
});
