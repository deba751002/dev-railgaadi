import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, maxWidth: 480, margin: '0 auto' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '10px 20px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
