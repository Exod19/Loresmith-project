import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ErrorBoundary from './ErrorBoundary';

// La fenêtre joueur (?view=player) n'a ni menus ni console : elle n'affiche que ce que le MJ pousse.
// Chaque fenêtre ne charge que son propre code : l'écran joueur s'ouvre vite, sans la console MJ.
const isPlayerScreen = new URLSearchParams(window.location.search).get('view') === 'player';
const Root = isPlayerScreen ? lazy(() => import('./present/PlayerScreen')) : lazy(() => import('./App.jsx'));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={null}>
        <Root />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>
);
