import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { ConfirmProvider } from './lib/confirm';
import { UserProvider } from './lib/userContext';
import { awaitAuthHydration } from './lib/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/tokens.css';
import './styles/components.css';
import './styles/utilities.css';
import './styles/animations.css';
import './styles/dash.css';
import './styles/responsive.css';
import './styles/theme-overrides.css';

// Aguarda a hidratação da auth (localStorage ← Preferences nativo) ANTES de
// renderizar. Sem isso, ao reabrir o app com a WebView tendo zerado o
// localStorage, a rota "/" leria Auth.token vazio e mandaria o usuário logado
// pro login/landing. A espera é de poucos ms e fica coberta pela splash nativa.
function mount() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <UserProvider>
            <ToastProvider>
              <ConfirmProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </ConfirmProvider>
            </ToastProvider>
          </UserProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

awaitAuthHydration().finally(mount);
