import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './app/ProtectedRoute';
import { LoginPlaceholder } from './app/LoginPlaceholder';
import { HomePlaceholder } from './app/HomePlaceholder';

/**
 * App shell (fundação): roteamento + guarda de rota. Nenhuma tela de
 * negócio ainda — só placeholders para o roteamento ser testável (ver
 * src/app/LoginPlaceholder.tsx e src/app/HomePlaceholder.tsx).
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPlaceholder />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomePlaceholder />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
