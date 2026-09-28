'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { describePasswordIssues } from '@/lib/auth-validation';

export interface AuthResult {
  profileComplete: boolean;
  missingFields?: string[];
}

interface AuthFormProps {
  mode: 'login' | 'signup';
  /** Called after a successful auth, before the redirect. */
  onSuccess?: (result: AuthResult) => void;
  autoFocus?: boolean;
}

/**
 * The single email + password form used by the auth gate modal and the
 * standalone /login and /signup pages.
 */
export function AuthForm({ mode, onSuccess, autoFocus = false }: AuthFormProps) {
  const router = useRouter();
  const isSignUp = mode === 'signup';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);

    // Catch weak passwords locally so the user gets feedback without a round trip.
    if (isSignUp) {
      const issues = describePasswordIssues(password);
      if (issues.length > 0) {
        setError(`Password needs ${issues.join(', ')}.`);
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Record pending intent: the user arrived here to start a video chat.
        await fetch('/api/auth/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: 'video' }),
        });
      }

      const res = await fetch(isSignUp ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data: AuthResult & { error?: string } = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      onSuccess?.(data);

      // Returning users with a finished profile go straight back to the lobby.
      if (!isSignUp && data.profileComplete) {
        router.push('/');
      } else {
        router.push('/profile/create');
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            backgroundColor: 'var(--surface-soft)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            color: 'var(--text-primary)',
          }}
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor={`${mode}-email`} className="type-controls" style={{ display: 'block', marginBottom: '6px' }}>
          Email
        </label>
        <input
          id={`${mode}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="form-input"
          autoFocus={autoFocus}
        />
      </div>

      <div>
        <label htmlFor={`${mode}-password`} className="type-controls" style={{ display: 'block', marginBottom: '6px' }}>
          Password
        </label>
        <input
          id={`${mode}-password`}
          name="password"
          type="password"
          required
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="form-input"
        />
        {isSignUp && (
          <p className="type-meta" style={{ marginTop: '6px' }}>
            Minimum 8 characters, including a letter and a number.
          </p>
        )}
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
        {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Log In'}
      </button>
    </form>
  );
}
