'use client';

import { useState, useRef, useEffect } from 'react';
import { signIn } from 'next-auth/react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export default function DemoLoginButton() {
  const [state, setState] = useState<'idle' | 'verifying' | 'logging-in' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  // Load Turnstile script
  useEffect(() => {
    if (!showTurnstile || scriptLoadedRef.current) return;
    if (document.getElementById('cf-turnstile-script')) {
      scriptLoadedRef.current = true;
      return;
    }

    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
    script.async = true;

    (window as unknown as Record<string, unknown>).onTurnstileLoad = () => {
      scriptLoadedRef.current = true;
      renderWidget();
    };

    document.head.appendChild(script);
  }, [showTurnstile]);

  // Render widget when container + script are ready
  useEffect(() => {
    if (showTurnstile && scriptLoadedRef.current && window.turnstile && turnstileRef.current) {
      renderWidget();
    }
  }, [showTurnstile]);

  function renderWidget() {
    if (!window.turnstile || !turnstileRef.current) return;
    if (widgetIdRef.current) return; // already rendered

    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: siteKey,
      callback: (token: string) => {
        setTurnstileToken(token);
      },
      'error-callback': () => {
        setError('Verification failed. Please try again.');
        setState('error');
      },
      theme: 'light',
      size: 'normal',
    });
  }

  // Auto-submit once we have a token
  useEffect(() => {
    if (turnstileToken) {
      handleDemoLogin(turnstileToken);
    }
  }, [turnstileToken]);

  async function handleDemoLogin(token: string) {
    setState('logging-in');
    setError(null);

    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstileToken: token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Demo login failed.');
        setState('error');
        return;
      }

      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Demo login failed. Please try again.');
        setState('error');
      } else if (result?.ok) {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setState('error');
    }
  }

  function handleClick() {
    setError(null);
    setShowTurnstile(true);
    setState('verifying');
  }

  if (!siteKey) return null;

  return (
    <div className="mt-6">
      {!showTurnstile && state === 'idle' && (
        <button
          type="button"
          onClick={handleClick}
          className="lp-demo-btn"
        >
          Want to test? Click here!
        </button>
      )}

      {showTurnstile && !turnstileToken && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium" style={{ color: 'rgba(0,0,0,0.6)' }}>
            Quick check — prove you&rsquo;re human:
          </p>
          <div ref={turnstileRef} />
        </div>
      )}

      {state === 'logging-in' && (
        <p className="text-sm font-medium text-center" style={{ color: 'rgba(0,0,0,0.6)' }}>
          Logging you in…
        </p>
      )}

      {error && (
        <div className="text-sm text-red-600 text-center mt-2">
          {error}{' '}
          <button
            type="button"
            onClick={() => {
              setShowTurnstile(false);
              setTurnstileToken(null);
              widgetIdRef.current = null;
              setState('idle');
              setError(null);
            }}
            className="underline font-medium"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
