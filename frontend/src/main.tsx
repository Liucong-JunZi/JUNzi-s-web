import { StrictMode } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import { persistResolvedLanguage, syncPreferredLanguage } from './i18n';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './App';
import { ThemeProvider } from './components/ThemeProvider';

const container = document.getElementById('root')!;
const tree = (
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);

if (container.hasChildNodes()) {
  hydrateRoot(container, tree);
  persistResolvedLanguage();
  syncPreferredLanguage();
} else {
  createRoot(container).render(tree);
  syncPreferredLanguage();
}
