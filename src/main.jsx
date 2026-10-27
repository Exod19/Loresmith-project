import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import PlayerScreen from './present/PlayerScreen';
import ErrorBoundary from './ErrorBoundary';

// La fenêtre joueur (?view=player) n'a ni menus ni console : elle n'affiche que ce que le MJ pousse.
const isPlayerScreen = new URLSearchParams(window.location.search).get('view') === 'player';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {isPlayerScreen ? <PlayerScreen /> : <App />}
    </ErrorBoundary>
  </StrictMode>
);
