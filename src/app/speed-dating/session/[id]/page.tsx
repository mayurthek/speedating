'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Avatar } from '@/components/Avatar';

interface SessionData {
  session: {
    id: string;
    status: string;
    started_at: string;
  };
  partner: {
    firstName: string;
    avatarType: string;
    gender: string;
    bio: string | null;
    interests: string[] | null;
  };
}

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      if (!sessionId) return;
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load session');
        }
        const sessionData = await res.json();
        setData(sessionData);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error loading session';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="app-container">
        <Header isAuthenticated={true} />
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <span className="ambient-dot" />
          <p className="type-meta" style={{ marginTop: '12px' }}>Connecting session...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app-container">
        <Header isAuthenticated={true} />
        <main style={{ maxWidth: '440px', margin: '40px auto 0', width: '100%', textAlign: 'center' }}>
          <div className="panel">
            <h2 className="type-heading" style={{ marginBottom: '8px' }}>Session Unavailable</h2>
            <p className="type-meta" style={{ marginBottom: '20px' }}>
              {error || 'The requested session could not be found or you are not authorized.'}
            </p>
            <Link href="/" className="btn btn-primary" style={{ width: '100%' }}>
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header isAuthenticated={true} />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '20px 10px',
        }}
      >
        <div className="panel" style={{ maxWidth: '480px', width: '100%', padding: '36px 24px' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 10px',
              backgroundColor: 'var(--surface-soft)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '20px',
            }}
          >
            Match Created · Session #{sessionId.substring(0, 8)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Avatar type={data.partner.avatarType || data.partner.gender} size={80} />
          </div>

          <h1 className="type-heading" style={{ marginBottom: '12px' }}>
            You&apos;ve been matched with {data.partner.firstName}.
          </h1>

          <p
            className="type-body"
            style={{
              color: 'var(--text-secondary)',
              fontSize: '15px',
              marginBottom: '32px',
              lineHeight: 1.5,
            }}
          >
            Video dating will begin in the next phase.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link
              href="/speed-dating/waiting"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              [ Find someone else ]
            </Link>
            <Link
              href="/"
              className="btn btn-outline"
              style={{ width: '100%', padding: '10px' }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
