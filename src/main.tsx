import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './contexts/ThemeContext';
import { initPwaInstallPromptCapture } from './lib/pwaInstallPrompt';
import './index.css';

initPwaInstallPromptCapture();

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
