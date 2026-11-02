import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import AppRoutes from './App';
import { ThemeProvider } from './components/ThemeProvider';
import i18n from './i18n';
import { setSSRData, type SSRPayload } from './ssr/data';

export interface RenderResult {
  html: string;
}

/**
 * Renders the app for one request. The caller must keep renders serialized:
 * i18next holds a single active language per process.
 */
export async function render(url: string, lang: string, data: SSRPayload): Promise<RenderResult> {
  setSSRData(data);
  await i18n.changeLanguage(lang);
  const html = renderToString(
    <StrictMode>
      <ThemeProvider>
        <StaticRouter location={url}>
          <AppRoutes />
        </StaticRouter>
      </ThemeProvider>
    </StrictMode>
  );
  return { html };
}
