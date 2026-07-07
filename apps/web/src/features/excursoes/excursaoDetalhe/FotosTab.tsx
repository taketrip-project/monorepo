import { useState, type ChangeEvent } from 'react';
import { Badge, Button } from '../../../ui';
import { ApiError } from '../../../lib/api/client';
import { enviarFoto, removerFoto, type Foto } from '../../../lib/api/excursions';
import './excursaoDetalhe.css';

interface FotosTabProps {
  excursaoId: string;
  destino: string;
  fotos: Foto[];
  /** Notifica o pai da nova lista, pra manter `excursao.fotos` em dia. */
  onFotosAtualizadas: (fotos: Foto[]) => void;
}

/** Aba "Fotos" (H1.6): upload/remoção, capa = menor `ordem`. */
export function FotosTab({ excursaoId, destino, fotos, onFotosAtualizadas }: FotosTabProps) {
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [fotoErro, setFotoErro] = useState<string | null>(null);
  const [removendoFotoId, setRemovendoFotoId] = useState<string | null>(null);

  const menorOrdemFoto = fotos.length > 0 ? Math.min(...fotos.map((f) => f.ordem)) : null;

  const onArquivoFoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;
    setFotoErro(null);
    setEnviandoFoto(true);
    try {
      const foto = await enviarFoto(excursaoId, arquivo);
      onFotosAtualizadas([...fotos, foto].sort((a, b) => a.ordem - b.ordem));
    } catch (error) {
      setFotoErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos enviar a foto agora. Tente de novo.',
      );
    } finally {
      setEnviandoFoto(false);
    }
  };

  const removerFotoClick = async (foto: Foto) => {
    setFotoErro(null);
    setRemovendoFotoId(foto.id);
    try {
      await removerFoto(excursaoId, foto.id);
      onFotosAtualizadas(fotos.filter((f) => f.id !== foto.id));
    } catch (error) {
      setFotoErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos remover a foto agora. Tente de novo.',
      );
    } finally {
      setRemovendoFotoId(null);
    }
  };

  return (
    <div className="tt-excursao-detalhe-tab-content">
      {fotoErro && (
        <p className="tt-excursao-detalhe-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {fotoErro}
        </p>
      )}

      {fotos.length === 0 ? (
        <p className="tt-excursao-detalhe-mute">Nenhuma foto ainda.</p>
      ) : (
        <div className="tt-excursao-detalhe-fotos-grid">
          {fotos.map((foto) => (
            <div key={foto.id} className="tt-excursao-detalhe-foto-item">
              <img src={foto.url} alt={`Foto de ${destino}`} className="tt-excursao-detalhe-foto-img" />
              {foto.ordem === menorOrdemFoto && (
                <Badge tone="mute" className="tt-excursao-detalhe-foto-capa">
                  Capa
                </Badge>
              )}
              <Button
                variant="ghost"
                size="md"
                fullWidth
                loading={removendoFotoId === foto.id}
                loadingLabel="Removendo..."
                onClick={() => removerFotoClick(foto)}
              >
                Remover
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="tt-excursao-detalhe-upload">
        <label className="tt-excursao-detalhe-upload-label" htmlFor="upload-foto">
          {enviandoFoto ? 'Enviando...' : 'Adicionar foto'}
        </label>
        <input
          id="upload-foto"
          className="tt-excursao-detalhe-upload-input"
          type="file"
          accept="image/*"
          disabled={enviandoFoto}
          onChange={onArquivoFoto}
        />
      </div>
    </div>
  );
}
