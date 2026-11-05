import { StrictMode, useEffect } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import { syncPreferredLanguage } from './i18n';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './App';
import { ThemeProvider } from './components/ThemeProvider';

function Preferences() {
  useEffect(() => { syncPreferredLanguage(); }, []);
  return null;
}

const container = document.getElementById('root')!;
const tree = (
  <StrictMode>
    <ThemeProvider>
      <Preferences />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);

if (container.hasChildNodes()) {
  hydrateRoot(container, tree);
} else {
  createRoot(container).render(tree);
}
