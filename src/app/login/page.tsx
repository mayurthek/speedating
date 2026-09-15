'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (provider: 'google' | 'apple' | 'email', customEmail?: string) => {
    setLoading(true);
    setError(null);

    const authEmail =
      customEmail ||
      (provider === 'google'
        ? 'demo.user@gmail.com'
        : provider === 'apple'
        ? 'demo.user@icloud.com'
        : email);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, provider, isSignUp: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.profileComplete) {
        router.push('/');
      } else {
        router.push('/profile/create');
      }
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Header />

      <main style={{ maxWidth: '440px', margin: '40px auto 0', width: '100%' }}>
        <div className="panel">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 className="type-heading" style={{ marginBottom: '8px' }}>
              Log in to Speedating
            </h1>
            <p className="type-meta">Return to your account and speed-dating sessions</p>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--surface-soft)',
                border: '1px solid var(--border-strong)',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleLogin('google')}
              className="btn btn-outline"
              style={{ width: '100%', gap: '10px' }}
            >
              Continue with Google
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleLogin('apple')}
              className="btn btn-outline"
              style={{ width: '100%', gap: '10px' }}
            >
              Continue with Apple
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin('email', email);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}
          >
            <div>
              <label htmlFor="email" className="type-controls" style={{ display: 'block', marginBottom: '6px' }}>
                Or log in with email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <span className="type-meta">Don&apos;t have an account? </span>
            <Link href="/signup" className="type-controls" style={{ color: 'var(--text-primary)' }}>
              Sign up
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
