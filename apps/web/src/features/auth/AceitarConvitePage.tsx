import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../../ui';
import { setSessionTokens } from '../../lib/session';
import { ApiError } from '../../lib/api/client';
import { aceitarConvite } from '../../lib/api/identity';
import { AuthLayout } from './AuthLayout';

export function AceitarConvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [nomeError, setNomeError] = useState<string | undefined>();
  const [senhaError, setSenhaError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // convite_invalido cobre também "sem token na URL" — mesmo tratamento.
  const [conviteInvalido, setConviteInvalido] = useState(!token);
  const [emailJaCadastrado, setEmailJaCadastrado] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    let ok = true;
    if (!nome.trim()) {
      setNomeError('Digite seu nome.');
      ok = false;
    } else {
      setNomeError(undefined);
    }
    if (senha.length < 8) {
      setSenhaError('A senha precisa ter pelo menos 8 caracteres.');
      ok = false;
    } else {
      setSenhaError(undefined);
    }
    if (!ok || !token) return;

    setLoading(true);
    try {
      const sessao = await aceitarConvite({ token, nome: nome.trim(), senha });
      setSessionTokens({ accessToken: sessao.tokens.access_token, refreshToken: sessao.tokens.refresh_token });
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.codigo === 'convite_invalido') {
          setConviteInvalido(true);
        } else if (error.codigo === 'email_ja_cadastrado') {
          setEmailJaCadastrado(error.mensagem);
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

  if (conviteInvalido) {
    return (
      <AuthLayout title="Convite inválido ou expirado">
        <p className="tt-auth-alert tt-auth-alert--danger" role="alert">
          <span className="tt-auth-alert-icon" aria-hidden="true">
            ⚠️
          </span>
          Esse convite não é mais válido. Pode ter expirado ou já ter sido aceito. Peça para quem te convidou
          mandar um novo.
        </p>
        <Button size="lg" fullWidth onClick={() => navigate('/login')}>
          Ir para o login
        </Button>
      </AuthLayout>
    );
  }

  if (emailJaCadastrado) {
    return (
      <AuthLayout title="Você já tem uma conta">
        <p className="tt-auth-alert tt-auth-alert--danger" role="alert">
          <span className="tt-auth-alert-icon" aria-hidden="true">
            ⚠️
          </span>
          {emailJaCadastrado}
        </p>
        <Button size="lg" fullWidth onClick={() => navigate('/login')}>
          Ir para o login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Aceitar convite" subtitle="Crie sua senha para entrar na equipe.">
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
          label="Senha"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          error={senhaError}
          hint={senhaError ? undefined : 'Pelo menos 8 caracteres.'}
        />

        {formError && (
          <p className="tt-auth-alert tt-auth-alert--danger" role="alert">
            <span className="tt-auth-alert-icon" aria-hidden="true">
              ⚠️
            </span>
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} loadingLabel="Entrando...">
          Aceitar convite e entrar
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
