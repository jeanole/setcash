'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleDeployment =
    error.message?.includes('Failed to find Server Action') ||
    error.digest?.includes('ACTION_NOT_FOUND');

  useEffect(() => {
    if (!isStaleDeployment) {
      console.error('[GlobalError]', error);
    }
  }, [error, isStaleDeployment]);

  if (isStaleDeployment) {
    return (
      <html>
        <body
          style={{
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ textAlign: 'center', padding: '40px', maxWidth: '400px' }}>
            <p style={{ fontSize: '32px', margin: '0 0 16px' }}>🔄</p>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>
              New version available
            </h1>
            <p style={{ fontSize: '15px', color: '#475569', margin: '0 0 24px', lineHeight: 1.6 }}>
              SetCash was updated while this tab was open. Please reload to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: 'var(--vb-accent)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload page
            </button>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html>
      <body
        style={{
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#f8fafc',
        }}
      >
        <div style={{ textAlign: 'center', padding: '40px', maxWidth: '400px' }}>
          <p style={{ fontSize: '32px', margin: '0 0 16px' }}>⚠️</p>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '15px', color: '#475569', margin: '0 0 24px', lineHeight: 1.6 }}>
            An unexpected error occurred.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: 'var(--vb-accent)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
