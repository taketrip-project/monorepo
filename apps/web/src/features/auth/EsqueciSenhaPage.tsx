import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '../../ui';
import { esqueciSenha } from '../../lib/api/identity';
import { isEmailValido } from '../../lib/validation';
import { AuthLayout } from './AuthLayout';

// Mensagem única, sempre igual, tenha o e-mail conta ou não — a API sempre
// responde 202 e nunca revela se o e-mail existe (docs/api/identity.yaml).
const MENSAGEM_SUCESSO =
  'Se esse e-mail estiver cadastrado, você vai receber uma mensagem com um link para redefinir a senha.';

export function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!email.trim() || !isEmailValido(email)) {
      setEmailError('Digite um e-mail válido.');
      return;
    }
    setEmailError(undefined);

    setLoading(true);
    try {
      await esqueciSenha(email.trim());
      setEnviado(true);
    } catch {
      setFormError('Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  if (enviado) {
    return (
      <AuthLayout title="Esqueci a senha">
        <p className="tt-auth-alert tt-auth-alert--success" role="status">
          <span className="tt-auth-alert-icon" aria-hidden="true">
            ✅
          </span>
          {MENSAGEM_SUCESSO}
        </p>
        <Link className="tt-auth-link" to="/login">
          Voltar para o login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Esqueci a senha" subtitle="Informe seu e-mail e mandamos um link para você criar uma nova senha.">
      <form className="tt-auth-form" onSubmit={onSubmit} noValidate>
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />

        {formError && (
          <p className="tt-auth-alert tt-auth-alert--danger" role="alert">
            <span className="tt-auth-alert-icon" aria-hidden="true">
              ⚠️
            </span>
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} loadingLabel="Enviando...">
          Enviar link
        </Button>

        <div className="tt-auth-links">
          <Link className="tt-auth-link" to="/login">
            Voltar para o login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
