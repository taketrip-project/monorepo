import { podeCancelar, podePublicar, type StatusExcursao } from './estado-excursao.util';

const TODOS_OS_STATUS: StatusExcursao[] = [
  'rascunho',
  'publicada',
  'lotada',
  'em_andamento',
  'concluida',
  'cancelada',
];

describe('excursions: máquina de estados', () => {
  describe('podePublicar', () => {
    it('permite publicar somente a partir de rascunho', () => {
      expect(podePublicar('rascunho')).toBe(true);
    });

    it.each(TODOS_OS_STATUS.filter((s) => s !== 'rascunho'))(
      'bloqueia publicar a partir de %s',
      (status) => {
        expect(podePublicar(status)).toBe(false);
      },
    );
  });

  describe('podeCancelar', () => {
    it.each(['rascunho', 'publicada', 'lotada'] as StatusExcursao[])(
      'permite cancelar a partir de %s (antes de em_andamento)',
      (status) => {
        expect(podeCancelar(status)).toBe(true);
      },
    );

    it.each(['em_andamento', 'concluida', 'cancelada'] as StatusExcursao[])(
      'bloqueia cancelar a partir de %s',
      (status) => {
        expect(podeCancelar(status)).toBe(false);
      },
    );
  });
});
