import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './ui';
import { ProtectedRoute } from './app/ProtectedRoute';
import { AppShell } from './app/AppShell';
import { InicioPage } from './app/InicioPage';
import { MaisPage } from './app/MaisPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegistroPage } from './features/auth/RegistroPage';
import { EsqueciSenhaPage } from './features/auth/EsqueciSenhaPage';
import { RedefinirSenhaPage } from './features/auth/RedefinirSenhaPage';
import { AceitarConvitePage } from './features/auth/AceitarConvitePage';
import { OrganizacaoPage } from './features/organizacao/OrganizacaoPage';
import { VeiculosPage } from './features/veiculos/VeiculosPage';
import { NovoVeiculoPage } from './features/veiculos/NovoVeiculoPage';
import { VeiculoDetalhePage } from './features/veiculos/VeiculoDetalhePage';
import { ExcursoesListPage } from './features/excursoes/ExcursoesListPage';
import { NovaExcursaoPage } from './features/excursoes/NovaExcursaoPage';
import { ExcursaoDetalhePage } from './features/excursoes/ExcursaoDetalhePage';

/**
 * App shell: roteamento público (auth) + roteamento protegido (AppShell com
 * BottomNav). Ver docs/api/identity.yaml para o contrato consumido por cada
 * tela pública.
 */
function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
          <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
          <Route path="/convite/aceitar" element={<AceitarConvitePage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<InicioPage />} />
              <Route path="/excursoes" element={<ExcursoesListPage />} />
              <Route path="/excursoes/nova" element={<NovaExcursaoPage />} />
              <Route path="/excursoes/:id" element={<ExcursaoDetalhePage />} />
              <Route path="/mais" element={<MaisPage />} />
              <Route path="/organizacao" element={<OrganizacaoPage />} />
              <Route path="/veiculos" element={<VeiculosPage />} />
              <Route path="/veiculos/novo" element={<NovoVeiculoPage />} />
              <Route path="/veiculos/:id" element={<VeiculoDetalhePage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
