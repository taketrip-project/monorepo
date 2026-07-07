import { useEffect, useState, type FormEvent } from 'react';
import { Badge, Button, Input, ListRow, Sheet } from '../../ui';
import { ApiError } from '../../lib/api/client';
import {
  atualizarOrganizacao,
  cancelarConvite,
  criarConvite,
  getOrganizacao,
  listarConvites,
  listarMembros,
  removerMembro,
  type Convite,
  type Membro,
} from '../../lib/api/identity';
import { extractFieldErrors } from '../../lib/api/fieldErrors';
import { formatDataHora } from '../../lib/format';
import { isEmailValido } from '../../lib/validation';
import './OrganizacaoPage.css';

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}

export function OrganizacaoPage() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  // Formulário da organização
  const [nomeOrg, setNomeOrg] = useState('');
  const [prazoHoras, setPrazoHoras] = useState('');
  const [sinalPercentual, setSinalPercentual] = useState('');
  const [nomeOrgError, setNomeOrgError] = useState<string | undefined>();
  const [prazoError, setPrazoError] = useState<string | undefined>();
  const [sinalError, setSinalError] = useState<string | undefined>();
  const [orgFormError, setOrgFormError] = useState<string | null>(null);
  const [salvandoOrg, setSalvandoOrg] = useState(false);
  const [orgSalva, setOrgSalva] = useState(false);

  // Sheet de novo convite
  const [sheetConviteAberto, setSheetConviteAberto] = useState(false);
  const [novoConviteEmail, setNovoConviteEmail] = useState('');
  const [novoConviteError, setNovoConviteError] = useState<string | undefined>();
  const [enviandoConvite, setEnviandoConvite] = useState(false);
  const [cancelandoConviteId, setCancelandoConviteId] = useState<string | null>(null);
  const [conviteAcaoErro, setConviteAcaoErro] = useState<string | null>(null);

  // Sheet de remoção de membro
  const [membroParaRemover, setMembroParaRemover] = useState<Membro | null>(null);
  const [removendoMembro, setRemovendoMembro] = useState(false);
  const [removerErro, setRemoverErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [org, memb, conv] = await Promise.all([getOrganizacao(), listarMembros(), listarConvites()]);
        if (cancelado) return;
        setNomeOrg(org.nome);
        setPrazoHoras(String(org.prazo_expiracao_reserva_horas));
        setSinalPercentual(String(org.sinal_default_percentual));
        setMembros(memb);
        setConvites(conv);
      } catch (error) {
        if (cancelado) return;
        setErroCarregar(
          error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar os dados da organização.',
        );
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const salvarOrganizacao = async (event: FormEvent) => {
    event.preventDefault();
    setOrgFormError(null);

    const prazo = Number.parseInt(prazoHoras, 10);
    const sinal = Number.parseInt(sinalPercentual, 10);
    let ok = true;
    if (!nomeOrg.trim()) {
      setNomeOrgError('Digite o nome da organização.');
      ok = false;
    } else {
      setNomeOrgError(undefined);
    }
    if (Number.isNaN(prazo) || prazo < 1 || prazo > 720) {
      setPrazoError('Informe um número entre 1 e 720 horas.');
      ok = false;
    } else {
      setPrazoError(undefined);
    }
    if (Number.isNaN(sinal) || sinal < 0 || sinal > 100) {
      setSinalError('Informe um valor entre 0 e 100.');
      ok = false;
    } else {
      setSinalError(undefined);
    }
    if (!ok) return;

    setSalvandoOrg(true);
    try {
      const atualizado = await atualizarOrganizacao({
        nome: nomeOrg.trim(),
        prazo_expiracao_reserva_horas: prazo,
        sinal_default_percentual: sinal,
      });
      setNomeOrg(atualizado.nome);
      setPrazoHoras(String(atualizado.prazo_expiracao_reserva_horas));
      setSinalPercentual(String(atualizado.sinal_default_percentual));
      setOrgSalva(true);
      window.setTimeout(() => setOrgSalva(false), 2400);
    } catch (error) {
      if (error instanceof ApiError && error.codigo === 'validacao') {
        const campos = extractFieldErrors(error.detalhes);
        let algumCampo = false;
        if (campos.nome) {
          setNomeOrgError(campos.nome);
          algumCampo = true;
        }
        if (campos.prazo_expiracao_reserva_horas) {
          setPrazoError(campos.prazo_expiracao_reserva_horas);
          algumCampo = true;
        }
        if (campos.sinal_default_percentual) {
          setSinalError(campos.sinal_default_percentual);
          algumCampo = true;
        }
        if (!algumCampo) setOrgFormError(error.mensagem);
      } else if (error instanceof ApiError) {
        setOrgFormError(error.mensagem);
      } else {
        setOrgFormError('Não conseguimos salvar agora. Tente de novo.');
      }
    } finally {
      setSalvandoOrg(false);
    }
  };

  const abrirSheetConvite = () => {
    setNovoConviteEmail('');
    setNovoConviteError(undefined);
    setSheetConviteAberto(true);
  };

  const enviarConvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!novoConviteEmail.trim() || !isEmailValido(novoConviteEmail)) {
      setNovoConviteError('Digite um e-mail válido.');
      return;
    }
    setEnviandoConvite(true);
    try {
      const convite = await criarConvite(novoConviteEmail.trim());
      setConvites((atual) => [...atual, convite]);
      setSheetConviteAberto(false);
    } catch (error) {
      // limite_membros e convite_ja_existe já chegam com mensagem pronta pt-BR.
      setNovoConviteError(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos enviar o convite agora. Tente de novo.',
      );
    } finally {
      setEnviandoConvite(false);
    }
  };

  const cancelarConviteClick = async (conviteId: string) => {
    setConviteAcaoErro(null);
    setCancelandoConviteId(conviteId);
    try {
      await cancelarConvite(conviteId);
      setConvites((atual) => atual.filter((c) => c.id !== conviteId));
    } catch (error) {
      setConviteAcaoErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos cancelar o convite agora. Tente de novo.',
      );
    } finally {
      setCancelandoConviteId(null);
    }
  };

  const removerMembroConfirmado = async () => {
    if (!membroParaRemover) return;
    setRemovendoMembro(true);
    setRemoverErro(null);
    try {
      await removerMembro(membroParaRemover.id);
      setMembros((atual) => atual.filter((m) => m.id !== membroParaRemover.id));
      setMembroParaRemover(null);
    } catch (error) {
      // ultimo_membro: não dá para remover o último membro da organização.
      setRemoverErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos remover agora. Tente de novo.',
      );
    } finally {
      setRemovendoMembro(false);
    }
  };

  if (carregando) {
    return (
      <div className="tt-org-page">
        <h1 className="tt-org-title">Organização</h1>
        <p className="tt-org-mute">Carregando...</p>
      </div>
    );
  }

  if (erroCarregar) {
    return (
      <div className="tt-org-page">
        <h1 className="tt-org-title">Organização</h1>
        <p className="tt-org-alert tt-org-alert--danger" role="alert">
          <span aria-hidden="true">⚠️</span> {erroCarregar}
        </p>
      </div>
    );
  }

  return (
    <div className="tt-org-page">
      <h1 className="tt-org-title">Organização</h1>

      <section className="tt-org-section">
        <h2 className="tt-org-section-title">Dados da organização</h2>
        <form className="tt-org-form" onSubmit={salvarOrganizacao} noValidate>
          <Input
            label="Nome da organização"
            maxLength={120}
            value={nomeOrg}
            onChange={(event) => setNomeOrg(event.target.value)}
            error={nomeOrgError}
          />
          <Input
            label="Prazo de expiração da reserva (horas)"
            type="number"
            inputMode="numeric"
            min={1}
            max={720}
            value={prazoHoras}
            onChange={(event) => setPrazoHoras(event.target.value)}
            error={prazoError}
            hint={prazoError ? undefined : 'Depois desse prazo sem pagamento, a reserva expira sozinha.'}
          />
          <Input
            label="Sinal padrão (%)"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            suffix="%"
            value={sinalPercentual}
            onChange={(event) => setSinalPercentual(event.target.value)}
            error={sinalError}
          />

          {orgFormError && (
            <p className="tt-org-alert tt-org-alert--danger" role="alert">
              <span aria-hidden="true">⚠️</span> {orgFormError}
            </p>
          )}
          {orgSalva && !orgFormError && (
            <p className="tt-org-alert tt-org-alert--success" role="status">
              <span aria-hidden="true">✅</span> Alterações salvas.
            </p>
          )}

          <Button type="submit" variant="secondary" loading={salvandoOrg} loadingLabel="Salvando...">
            Salvar alterações
          </Button>
        </form>
      </section>

      <section className="tt-org-section">
        <div className="tt-org-section-header">
          <h2 className="tt-org-section-title">Equipe</h2>
          <Badge tone="mute">
            {membros.length}/3
          </Badge>
        </div>

        <div className="tt-org-list">
          {membros.map((membro) => (
            <ListRow
              key={membro.id}
              avatar={iniciais(membro.nome)}
              title={membro.nome}
              subtitle={membro.email}
              badge={
                membros.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMembroParaRemover(membro)}
                    aria-label={`Remover ${membro.nome}`}
                  >
                    Remover
                  </Button>
                ) : undefined
              }
            />
          ))}
        </div>

        <div className="tt-org-section-header">
          <h3 className="tt-org-subsection-title">Convites pendentes</h3>
          <Button variant="soft" size="sm" onClick={abrirSheetConvite}>
            Convidar
          </Button>
        </div>

        {conviteAcaoErro && (
          <p className="tt-org-alert tt-org-alert--danger" role="alert">
            <span aria-hidden="true">⚠️</span> {conviteAcaoErro}
          </p>
        )}

        {convites.length === 0 ? (
          <p className="tt-org-mute">Nenhum convite pendente.</p>
        ) : (
          <div className="tt-org-list">
            {convites.map((convite) => (
              <ListRow
                key={convite.id}
                avatar="✉️"
                title={convite.email}
                subtitle={`Expira em ${formatDataHora(convite.expira_em)}`}
                badge={
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={cancelandoConviteId === convite.id}
                    loadingLabel="Cancelando..."
                    onClick={() => cancelarConviteClick(convite.id)}
                  >
                    Cancelar
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </section>

      <Sheet open={sheetConviteAberto} onClose={() => setSheetConviteAberto(false)} title="Convidar colega">
        <form className="tt-org-form" onSubmit={enviarConvite} noValidate>
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            value={novoConviteEmail}
            onChange={(event) => setNovoConviteEmail(event.target.value)}
            error={novoConviteError}
          />
          <Button type="submit" fullWidth loading={enviandoConvite} loadingLabel="Enviando...">
            Enviar convite
          </Button>
        </form>
      </Sheet>

      <Sheet
        open={membroParaRemover !== null}
        onClose={() => {
          setMembroParaRemover(null);
          setRemoverErro(null);
        }}
        title="Remover membro"
      >
        <div className="tt-org-form">
          <p>
            Remover <strong>{membroParaRemover?.nome}</strong> da equipe? Isso encerra a sessão dele em todos os
            dispositivos imediatamente.
          </p>
          {removerErro && (
            <p className="tt-org-alert tt-org-alert--danger" role="alert">
              <span aria-hidden="true">⚠️</span> {removerErro}
            </p>
          )}
          <div className="tt-org-sheet-actions">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setMembroParaRemover(null);
                setRemoverErro(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              fullWidth
              loading={removendoMembro}
              loadingLabel="Removendo..."
              onClick={removerMembroConfirmado}
            >
              Remover membro
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
