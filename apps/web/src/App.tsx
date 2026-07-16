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
import { ReservaDetalhePage } from './features/excursoes/ReservaDetalhePage';
import { ExcursaoPublicaPage } from './features/publico/ExcursaoPublicaPage';
import { ReservaPublicaRoute } from './features/publico/ReservaPublicaPage';
import { PrivacidadePage } from './features/publico/PrivacidadePage';

/**
 * App shell: roteamento público (auth + página da excursão/reserva do
 * passageiro, H3.1/H3.2) + roteamento protegido (AppShell com BottomNav).
 * Ver docs/api/identity.yaml e docs/api/publico.yaml para os contratos
 * consumidos pelas telas públicas.
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

          {/* Páginas do passageiro — sem login, sem AppShell (H3.1/H3.2).
              /e/{codigo} é o mesmo padrão da `url_publica` compartilhada
              pelo organizador; /r/{reservaId} é o link de acompanhamento. */}
          <Route path="/e/:codigo" element={<ExcursaoPublicaPage />} />
          <Route path="/r/:reservaId" element={<ReservaPublicaRoute />} />
          {/* Política de privacidade (H3.7, ADR 010) — linkada do formulário
              público de reserva; estática, sem login. */}
          <Route path="/privacidade" element={<PrivacidadePage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<InicioPage />} />
              <Route path="/excursoes" element={<ExcursoesListPage />} />
              <Route path="/excursoes/nova" element={<NovaExcursaoPage />} />
              <Route path="/excursoes/:id" element={<ExcursaoDetalhePage />} />
              <Route path="/excursoes/:id/reservas/:reservaId" element={<ReservaDetalhePage />} />
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
