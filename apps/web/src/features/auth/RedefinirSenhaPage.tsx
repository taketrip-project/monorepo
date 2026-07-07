import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../../ui';
import { ApiError } from '../../lib/api/client';
import { redefinirSenha } from '../../lib/api/identity';
import { extractFieldErrors } from '../../lib/api/fieldErrors';
import { AuthLayout } from './AuthLayout';

export function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [senhaError, setSenhaError] = useState<string | undefined>();
  const [confirmacaoError, setConfirmacaoError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redefinida, setRedefinida] = useState(false);
  // token_invalido cobre também "sem token na URL" — mesmo tratamento.
  const [tokenInvalido, setTokenInvalido] = useState(!token);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    let ok = true;
    if (senha.length < 8) {
      setSenhaError('A senha precisa ter pelo menos 8 caracteres.');
      ok = false;
    } else {
      setSenhaError(undefined);
    }
    if (confirmacao !== senha) {
      setConfirmacaoError('As senhas não coincidem.');
      ok = false;
    } else {
      setConfirmacaoError(undefined);
    }
    if (!ok || !token) return;

    setLoading(true);
    try {
      await redefinirSenha(token, senha);
      setRedefinida(true);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.codigo === 'token_invalido') {
          setTokenInvalido(true);
        } else if (error.codigo === 'validacao') {
          const campos = extractFieldErrors(error.detalhes);
          const mensagemSenha = campos.nova_senha ?? campos.senha;
          if (mensagemSenha) setSenhaError(mensagemSenha);
          else setFormError(error.mensagem);
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

  if (redefinida) {
    return (
      <AuthLayout title="Senha redefinida">
        <p className="tt-auth-alert tt-auth-alert--success" role="status">
          <span className="tt-auth-alert-icon" aria-hidden="true">
            ✅
          </span>
          Sua senha foi alterada. Já pode entrar com ela.
        </p>
        <Button size="lg" fullWidth onClick={() => navigate('/login', { replace: true })}>
          Ir para o login
        </Button>
      </AuthLayout>
    );
  }

  if (tokenInvalido) {
    return (
      <AuthLayout title="Link inválido ou expirado">
        <p className="tt-auth-alert tt-auth-alert--danger" role="alert">
          <span className="tt-auth-alert-icon" aria-hidden="true">
            ⚠️
          </span>
          Esse link de redefinição não é mais válido. Pode ter expirado ou já ter sido usado.
        </p>
        <Button size="lg" fullWidth onClick={() => navigate('/esqueci-senha')}>
          Pedir um novo link
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Criar nova senha">
      <form className="tt-auth-form" onSubmit={onSubmit} noValidate>
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          error={senhaError}
          hint={senhaError ? undefined : 'Pelo menos 8 caracteres.'}
        />
        <Input
          label="Confirme a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(event) => setConfirmacao(event.target.value)}
          error={confirmacaoError}
        />

        {formError && (
          <p className="tt-auth-alert tt-auth-alert--danger" role="alert">
            <span className="tt-auth-alert-icon" aria-hidden="true">
              ⚠️
            </span>
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} loadingLabel="Salvando...">
          Salvar nova senha
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
