import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { ConfirmProvider } from './lib/confirm';
import { UserProvider } from './lib/userContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/tokens.css';
import './styles/components.css';
import './styles/utilities.css';
import './styles/animations.css';
import './styles/dash.css';
import './styles/responsive.css';
import './styles/theme-overrides.css';

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
