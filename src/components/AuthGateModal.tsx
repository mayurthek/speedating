'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
}

export function AuthGateModal({ isOpen, onClose, defaultMode = 'signup' }: AuthGateModalProps) {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(defaultMode === 'signup');
  const [email, setEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProviderAuth = async (provider: 'google' | 'apple' | 'email', customEmail?: string) => {
    setLoading(true);
    setError(null);

    try {
      // Record pending intent: "video"
      await fetch('/api/auth/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'video' }),
      });

      // Submit auth
      const authEmail =
        customEmail ||
        (provider === 'google'
          ? 'demo.user@gmail.com'
          : provider === 'apple'
          ? 'demo.user@icloud.com'
          : email);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail,
          provider,
          isSignUp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onClose();
      // If user profile is complete, redirect to video flow (or / if home), else /profile/create
      if (data.profileComplete) {
        router.push('/');
      } else {
        router.push('/profile/create');
      }
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during authentication';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    handleProviderAuth('email', email);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 10px',
              backgroundColor: 'var(--surface-soft)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
            }}
          >
            Video Chat Selected
          </div>
          <h2
            id="auth-modal-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              marginBottom: '6px',
            }}
          >
            {isSignUp ? 'Sign up to continue' : 'Log in to continue'}
          </h2>
          <p className="type-meta" style={{ fontSize: '13px' }}>
            Speedating is strictly 18+. Instant 3-minute video dates.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--surface-soft)',
              border: '1px solid var(--border-strong)',
              fontSize: '13px',
              marginBottom: '16px',
              color: 'var(--text-primary)',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleProviderAuth('google')}
            className="btn btn-outline"
            style={{ width: '100%', gap: '10px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleProviderAuth('apple')}
            className="btn btn-outline"
            style={{ width: '100%', gap: '10px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.42c.6-1.02.99-2.35.83-3.72-1.18.06-2.55.83-3.33 1.76-.55.65-1.03 1.99-.87 3.32 1.32.1 2.76-.73 3.37-1.36z" />
            </svg>
            Continue with Apple
          </button>

          {!showEmailInput ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowEmailInput(true)}
              className="btn btn-outline"
              style={{ width: '100%' }}
            >
              Continue with email
            </button>
          ) : (
            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                autoFocus
              />
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                {loading ? 'Processing...' : isSignUp ? 'Sign up with email' : 'Log in with email'}
              </button>
            </form>
          )}
        </div>

        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="btn-subtle"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            {isSignUp ? (
              <span>
                Already have an account? <strong style={{ textDecoration: 'underline' }}>Log in</strong>
              </span>
            ) : (
              <span>
                Don&apos;t have an account? <strong style={{ textDecoration: 'underline' }}>Sign up</strong>
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
            style={{ width: '100%', fontSize: '13px', padding: '8px 14px' }}
          >
            Back
          </button>

          <div className="type-meta" style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px' }}>
            By continuing, you agree to our 18+ policy, Terms, and Safety Guidelines.
          </div>
        </div>
      </div>
    </div>
  );
}
