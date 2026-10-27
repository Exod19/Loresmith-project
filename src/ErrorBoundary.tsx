import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Filet de sécurité : un plantage affiche le message d'erreur au lieu d'un écran blanc. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Loresmith : erreur d’affichage', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, color: '#e7d8b0', background: '#0b0906', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 20 }}>Une erreur a empêché l’affichage</h1>
        <p>Copie ce message et envoie-le à Claude, avec ce que tu faisais juste avant :</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#16110a', padding: 12, borderRadius: 6 }}>
          {String(this.state.error.message)}
          {'\n\n'}
          {this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
        </pre>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 14px', marginTop: 8 }}>Recharger</button>
      </div>
    );
  }
}
