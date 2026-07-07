import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input } from '../../ui';
import { setSessionTokens } from '../../lib/session';
import { ApiError } from '../../lib/api/client';
import { login } from '../../lib/api/identity';
import { isEmailValido } from '../../lib/validation';
import { AuthLayout } from './AuthLayout';

function formatEspera(segundos: number): string {
  if (segundos >= 60) return `${Math.ceil(segundos / 60)} min`;
  return `${segundos}s`;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [senhaError, setSenhaError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [esperaSegundos, setEsperaSegundos] = useState(0);

  // Contagem regressiva do 429 (muitas_tentativas) — trava o botão até o
  // Retry-After acabar, em vez de deixar o organizador tentar de novo cedo
  // e tomar outro 429.
  useEffect(() => {
    if (esperaSegundos <= 0) return;
    const timer = window.setInterval(() => {
      setEsperaSegundos((atual) => Math.max(0, atual - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [esperaSegundos]);

  const validar = (): boolean => {
    let ok = true;
    if (!email.trim() || !isEmailValido(email)) {
      setEmailError('Digite um e-mail válido.');
      ok = false;
    } else {
      setEmailError(undefined);
    }
    if (!senha) {
      setSenhaError('Digite sua senha.');
      ok = false;
    } else {
      setSenhaError(undefined);
    }
    return ok;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validar()) return;

    setLoading(true);
    try {
      const sessao = await login(email.trim(), senha);
      setSessionTokens({ accessToken: sessao.tokens.access_token, refreshToken: sessao.tokens.refresh_token });
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.codigo === 'muitas_tentativas') {
          setFormError(
            error.retryAfterSeconds
              ? `${error.mensagem} Tente de novo em ${formatEspera(error.retryAfterSeconds)}.`
              : error.mensagem,
          );
          setEsperaSegundos(error.retryAfterSeconds ?? 0);
        } else {
          // credenciais_invalidas e qualquer outro código: a API já manda
          // uma mensagem pt-BR pronta para exibir.
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
    <AuthLayout title="Entrar" subtitle="Acesse sua conta Taketrip.">
      <form className="tt-auth-form" onSubmit={onSubmit} noValidate>
        <Input
          label="E-mail"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          error={senhaError}
        />

        {formError && (
          <p className="tt-auth-alert tt-auth-alert--danger" role="alert">
            <span className="tt-auth-alert-icon" aria-hidden="true">
              ⚠️
            </span>
            {formError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={loading}
          loadingLabel="Entrando..."
          disabled={esperaSegundos > 0}
        >
          {esperaSegundos > 0 ? `Aguarde ${formatEspera(esperaSegundos)}` : 'Entrar'}
        </Button>

        <div className="tt-auth-links">
          <Link className="tt-auth-link" to="/esqueci-senha">
            Esqueci a senha
          </Link>
          <Link className="tt-auth-link" to="/registro">
            Criar conta
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
