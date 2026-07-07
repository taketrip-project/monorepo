import { useState, type FormEvent } from 'react';
import { Button, Input, Sheet } from '../../../ui';
import { ApiError } from '../../../lib/api/client';
import {
  adicionarPontoEmbarque,
  editarPontoEmbarque,
  removerPontoEmbarque,
  reordenarPontosEmbarque,
  type PontoEmbarque,
} from '../../../lib/api/excursions';
import { extractFieldErrors } from '../../../lib/api/fieldErrors';
import { formatHora } from '../../../lib/format';
import { toDatetimeLocalValue } from '../datetimeLocal';
import './excursaoDetalhe.css';

interface PontosEmbarqueTabProps {
  excursaoId: string;
  pontos: PontoEmbarque[];
  /** Notifica o pai da nova lista, pra manter `excursao.pontos_embarque` em dia. */
  onPontosAtualizados: (pontos: PontoEmbarque[]) => void;
}

/**
 * Aba "Pontos de embarque" (H1.6): CRUD + reorder (mover ↑/↓). Erros
 * `ponto_com_passageiros` e `ultimo_ponto` (docs/api/excursions.yaml) já
 * chegam com mensagem pt-BR pronta do servidor — só exibimos.
 */
export function PontosEmbarqueTab({ excursaoId, pontos, onPontosAtualizados }: PontosEmbarqueTabProps) {
  const [pontoSheetAberto, setPontoSheetAberto] = useState(false);
  const [pontoEditando, setPontoEditando] = useState<PontoEmbarque | null>(null);
  const [pontoLocal, setPontoLocal] = useState('');
  const [pontoHorario, setPontoHorario] = useState('');
  const [pontoLocalError, setPontoLocalError] = useState<string | undefined>();
  const [pontoHorarioError, setPontoHorarioError] = useState<string | undefined>();
  const [pontoFormError, setPontoFormError] = useState<string | null>(null);
  const [salvandoPonto, setSalvandoPonto] = useState(false);
  const [pontoParaRemover, setPontoParaRemover] = useState<PontoEmbarque | null>(null);
  const [removendoPonto, setRemovendoPonto] = useState(false);
  const [removerPontoErro, setRemoverPontoErro] = useState<string | null>(null);
  const [reordenandoPontoId, setReordenandoPontoId] = useState<string | null>(null);
  const [reordenarErro, setReordenarErro] = useState<string | null>(null);

  const abrirAdicionarPonto = () => {
    setPontoEditando(null);
    setPontoLocal('');
    setPontoHorario('');
    setPontoLocalError(undefined);
    setPontoHorarioError(undefined);
    setPontoFormError(null);
    setPontoSheetAberto(true);
  };

  const abrirEditarPonto = (ponto: PontoEmbarque) => {
    setPontoEditando(ponto);
    setPontoLocal(ponto.local);
    setPontoHorario(toDatetimeLocalValue(ponto.horario));
    setPontoLocalError(undefined);
    setPontoHorarioError(undefined);
    setPontoFormError(null);
    setPontoSheetAberto(true);
  };

  const salvarPonto = async (event: FormEvent) => {
    event.preventDefault();
    let ok = true;
    if (!pontoLocal.trim()) {
      setPontoLocalError('Digite o local do embarque.');
      ok = false;
    } else {
      setPontoLocalError(undefined);
    }
    if (!pontoHorario) {
      setPontoHorarioError('Escolha o horário.');
      ok = false;
    } else {
      setPontoHorarioError(undefined);
    }
    if (!ok) return;

    setSalvandoPonto(true);
    setPontoFormError(null);
    try {
      const input = { local: pontoLocal.trim(), horario: new Date(pontoHorario).toISOString() };
      const salvo = pontoEditando
        ? await editarPontoEmbarque(excursaoId, pontoEditando.id, input)
        : await adicionarPontoEmbarque(excursaoId, input);
      const semEsse = pontos.filter((p) => p.id !== salvo.id);
      onPontosAtualizados([...semEsse, salvo].sort((a, b) => a.ordem - b.ordem));
      setPontoSheetAberto(false);
    } catch (error) {
      if (error instanceof ApiError && error.codigo === 'validacao') {
        const campos = extractFieldErrors(error.detalhes);
        let algumCampo = false;
        if (campos.local) {
          setPontoLocalError(campos.local);
          algumCampo = true;
        }
        if (campos.horario) {
          setPontoHorarioError(campos.horario);
          algumCampo = true;
        }
        if (!algumCampo) setPontoFormError(error.mensagem);
      } else if (error instanceof ApiError) {
        setPontoFormError(error.mensagem);
      } else {
        setPontoFormError('Não conseguimos salvar agora. Tente de novo.');
      }
    } finally {
      setSalvandoPonto(false);
    }
  };

  const confirmarRemoverPonto = async () => {
    if (!pontoParaRemover) return;
    setRemovendoPonto(true);
    setRemoverPontoErro(null);
    try {
      await removerPontoEmbarque(excursaoId, pontoParaRemover.id);
      onPontosAtualizados(pontos.filter((p) => p.id !== pontoParaRemover.id));
      setPontoParaRemover(null);
    } catch (error) {
      setRemoverPontoErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos remover agora. Tente de novo.',
      );
    } finally {
      setRemovendoPonto(false);
    }
  };

  const moverPonto = async (ponto: PontoEmbarque, direcao: -1 | 1) => {
    const indice = pontos.findIndex((p) => p.id === ponto.id);
    const novoIndice = indice + direcao;
    if (indice < 0 || novoIndice < 0 || novoIndice >= pontos.length) return;

    const reordenados = [...pontos];
    const [movido] = reordenados.splice(indice, 1);
    reordenados.splice(novoIndice, 0, movido);

    setReordenandoPontoId(ponto.id);
    setReordenarErro(null);
    try {
      const atualizados = await reordenarPontosEmbarque(
        excursaoId,
        reordenados.map((p) => p.id),
      );
      onPontosAtualizados([...atualizados].sort((a, b) => a.ordem - b.ordem));
    } catch (error) {
      setReordenarErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos reordenar agora. Tente de novo.',
      );
    } finally {
      setReordenandoPontoId(null);
    }
  };

  return (
    <div className="tt-excursao-detalhe-tab-content">
      {pontos.length === 0 && (
        <p className="tt-excursao-detalhe-mute">Nenhum ponto de embarque ainda. Adicione pelo menos um.</p>
      )}

      {reordenarErro && (
        <p className="tt-excursao-detalhe-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {reordenarErro}
        </p>
      )}

      <div className="tt-excursao-detalhe-pontos-list">
        {pontos.map((ponto, index) => (
          <div key={ponto.id} className="tt-excursao-detalhe-ponto-row">
            <div className="tt-excursao-detalhe-ponto-info">
              <span className="tt-excursao-detalhe-ponto-local">{ponto.local}</span>
              <span className="tt-excursao-detalhe-ponto-horario tt-mono">{formatHora(ponto.horario)}</span>
            </div>
            <div className="tt-excursao-detalhe-ponto-actions">
              <button
                type="button"
                className="tt-excursao-detalhe-icon-btn"
                aria-label={`Mover ${ponto.local} para cima`}
                disabled={index === 0 || reordenandoPontoId !== null}
                onClick={() => moverPonto(ponto, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="tt-excursao-detalhe-icon-btn"
                aria-label={`Mover ${ponto.local} para baixo`}
                disabled={index === pontos.length - 1 || reordenandoPontoId !== null}
                onClick={() => moverPonto(ponto, 1)}
              >
                ↓
              </button>
              <Button variant="ghost" size="md" onClick={() => abrirEditarPonto(ponto)}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setPontoParaRemover(ponto);
                  setRemoverPontoErro(null);
                }}
              >
                Remover
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="secondary" fullWidth onClick={abrirAdicionarPonto}>
        Adicionar ponto de embarque
      </Button>

      <Sheet
        open={pontoSheetAberto}
        onClose={() => setPontoSheetAberto(false)}
        title={pontoEditando ? 'Editar ponto de embarque' : 'Adicionar ponto de embarque'}
      >
        <form className="tt-excursao-detalhe-sheet-form" onSubmit={salvarPonto} noValidate>
          <Input
            label="Local"
            maxLength={200}
            value={pontoLocal}
            onChange={(event) => setPontoLocal(event.target.value)}
            error={pontoLocalError}
          />
          <Input
            label="Horário"
            type="datetime-local"
            value={pontoHorario}
            onChange={(event) => setPontoHorario(event.target.value)}
            error={pontoHorarioError}
          />
          {pontoFormError && (
            <p className="tt-excursao-detalhe-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {pontoFormError}
            </p>
          )}
          <Button type="submit" fullWidth loading={salvandoPonto} loadingLabel="Salvando...">
            {pontoEditando ? 'Salvar ponto' : 'Adicionar ponto'}
          </Button>
        </form>
      </Sheet>

      <Sheet
        open={pontoParaRemover !== null}
        onClose={() => {
          setPontoParaRemover(null);
          setRemoverPontoErro(null);
        }}
        title="Remover ponto de embarque"
      >
        <div className="tt-excursao-detalhe-sheet-form">
          <p>Remover o ponto "{pontoParaRemover?.local}"?</p>
          {removerPontoErro && (
            <p className="tt-excursao-detalhe-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {removerPontoErro}
            </p>
          )}
          <div className="tt-excursao-detalhe-sheet-actions">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setPontoParaRemover(null);
                setRemoverPontoErro(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              fullWidth
              loading={removendoPonto}
              loadingLabel="Removendo..."
              onClick={confirmarRemoverPonto}
            >
              Remover ponto
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
