import { useState } from 'react';
import { ApiError } from '../../../lib/api/client';
import { atualizarChecklistLegal, type ChecklistLegal } from '../../../lib/api/excursions';
import './excursaoDetalhe.css';

const CHECKLIST_ITEMS: { campo: keyof ChecklistLegal; label: string }[] = [
  { campo: 'licenca_antt', label: 'Licença ANTT de viagem' },
  { campo: 'seguro_passageiros', label: 'Seguro de passageiros' },
  { campo: 'lista_impressa', label: 'Lista de passageiros impressa' },
];

interface ChecklistLegalTabProps {
  excursaoId: string;
  checklist: ChecklistLegal;
  /** Notifica o pai do novo checklist, pra manter `excursao.checklist_legal` em dia. */
  onChecklistAtualizado: (checklist: ChecklistLegal) => void;
}

/** Aba "Checklist legal" (H3.5): 3 toggles informativos — nunca travam nada. */
export function ChecklistLegalTab({ excursaoId, checklist, onChecklistAtualizado }: ChecklistLegalTabProps) {
  const [checklistErro, setChecklistErro] = useState<string | null>(null);
  const [salvandoChecklistCampo, setSalvandoChecklistCampo] = useState<keyof ChecklistLegal | null>(null);

  const alternarChecklist = async (campo: keyof ChecklistLegal) => {
    const valorAnterior = checklist[campo];
    onChecklistAtualizado({ ...checklist, [campo]: !valorAnterior });
    setChecklistErro(null);
    setSalvandoChecklistCampo(campo);
    try {
      const atualizado = await atualizarChecklistLegal(excursaoId, { [campo]: !valorAnterior });
      onChecklistAtualizado(atualizado);
    } catch (error) {
      onChecklistAtualizado({ ...checklist, [campo]: valorAnterior });
      setChecklistErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos salvar agora. Tente de novo.',
      );
    } finally {
      setSalvandoChecklistCampo(null);
    }
  };

  return (
    <div className="tt-excursao-detalhe-tab-content">
      <p className="tt-excursao-detalhe-mute">
        É só um lembrete — nada aqui trava a publicação ou qualquer outra ação.
      </p>
      <div className="tt-excursao-detalhe-checklist">
        {CHECKLIST_ITEMS.map((item) => (
          <label key={item.campo} className="tt-excursao-detalhe-checklist-item">
            <input
              type="checkbox"
              checked={checklist[item.campo]}
              disabled={salvandoChecklistCampo === item.campo}
              onChange={() => alternarChecklist(item.campo)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      {checklistErro && (
        <p className="tt-excursao-detalhe-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {checklistErro}
        </p>
      )}
    </div>
  );
}
