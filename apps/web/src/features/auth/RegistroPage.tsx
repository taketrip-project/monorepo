import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input } from '../../ui';
import { setSessionTokens } from '../../lib/session';
import { ApiError } from '../../lib/api/client';
import { registrar } from '../../lib/api/identity';
import { extractFieldErrors } from '../../lib/api/fieldErrors';
import { isEmailValido } from '../../lib/validation';
import { AuthLayout } from './AuthLayout';

/** Cadastro mínimo (H1.1): nome, e-mail, senha, nome da organização — no máximo esses 4 campos. */
export function RegistroPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nomeOrganizacao, setNomeOrganizacao] = useState('');

  const [nomeError, setNomeError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [senhaError, setSenhaError] = useState<string | undefined>();
  const [nomeOrganizacaoError, setNomeOrganizacaoError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validar = (): boolean => {
    let ok = true;
    if (!nome.trim()) {
      setNomeError('Digite seu nome.');
      ok = false;
    } else {
      setNomeError(undefined);
    }
    if (!email.trim() || !isEmailValido(email)) {
      setEmailError('Digite um e-mail válido.');
      ok = false;
    } else {
      setEmailError(undefined);
    }
    if (senha.length < 8) {
      setSenhaError('A senha precisa ter pelo menos 8 caracteres.');
      ok = false;
    } else {
      setSenhaError(undefined);
    }
    if (!nomeOrganizacao.trim()) {
      setNomeOrganizacaoError('Digite o nome da sua empresa.');
      ok = false;
    } else {
      setNomeOrganizacaoError(undefined);
    }
    return ok;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validar()) return;

    setLoading(true);
    try {
      const sessao = await registrar({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        nome_organizacao: nomeOrganizacao.trim(),
      });
      setSessionTokens({ accessToken: sessao.tokens.access_token, refreshToken: sessao.tokens.refresh_token });
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.codigo === 'email_ja_cadastrado') {
          setEmailError(error.mensagem);
        } else if (error.codigo === 'validacao') {
          const campos = extractFieldErrors(error.detalhes);
          let algumCampo = false;
          if (campos.nome) {
            setNomeError(campos.nome);
            algumCampo = true;
          }
          if (campos.email) {
            setEmailError(campos.email);
            algumCampo = true;
          }
          if (campos.senha) {
            setSenhaError(campos.senha);
            algumCampo = true;
          }
          if (campos.nome_organizacao) {
            setNomeOrganizacaoError(campos.nome_organizacao);
            algumCampo = true;
          }
          if (!algumCampo) setFormError(error.mensagem);
        } else {
          setFormError(error.mensagem);
        }
      } else {
        setFormError('Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Criar conta" subtitle="Cadastre você e sua empresa em menos de um minuto.">
      <form className="tt-auth-form" onSubmit={onSubmit} noValidate>
        <Input
          label="Nome"
          autoComplete="name"
          maxLength={120}
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          error={nomeError}
        />
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          error={senhaError}
          hint={senhaError ? undefined : 'Pelo menos 8 caracteres.'}
        />
        <Input
          label="Nome da empresa"
          maxLength={120}
          value={nomeOrganizacao}
          onChange={(event) => setNomeOrganizacao(event.target.value)}
          error={nomeOrganizacaoError}
        />

        {formError && (
          <p className="tt-auth-alert tt-auth-alert--danger" role="alert">
            <span className="tt-auth-alert-icon" aria-hidden="true">
              ⚠️
            </span>
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} loadingLabel="Criando conta...">
          Criar conta
        </Button>

        <div className="tt-auth-links">
          <Link className="tt-auth-link" to="/login">
            Já tenho conta
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
