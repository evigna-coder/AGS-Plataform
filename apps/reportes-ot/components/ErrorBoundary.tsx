import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const BaseComponent = React.Component as any;

class _ErrorBoundary extends BaseComponent {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null } as ErrorBoundaryState;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    const state = this.state as ErrorBoundaryState;
    const props = this.props as ErrorBoundaryProps;

    if (state.hasError) {
      if (props.fallback) return props.fallback;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
            Algo salió mal
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem', maxWidth: '28rem' }}>
            {state.error?.message || 'Ocurrió un error inesperado.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: '#fff', backgroundColor: '#4f46e5', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}
          >
            Recargar página
          </button>
        </div>
      );
    }

    return props.children;
  }
}

export const ErrorBoundary = _ErrorBoundary as unknown as React.ComponentType<ErrorBoundaryProps>;
