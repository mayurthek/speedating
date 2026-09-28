'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';

export default function WaitingQueuePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function initQueue() {
      try {
        const joinRes = await fetch('/api/queue/join', { method: 'POST' });
        if (!joinRes.ok) {
          const errData = await joinRes.json().catch(() => ({}));
          if (joinRes.status === 401) {
            router.push('/');
            return;
          }
          setError(errData.error || 'Unable to join the queue. Make sure your profile is complete.');
          return;
        }

        const joinData = await joinRes.json();
        if (!isSubscribed) return;

        if (joinData.status === 'MATCHED' && joinData.sessionId) {
          router.push(`/speed-dating/session/${joinData.sessionId}`);
          return;
        }

        const es = new EventSource('/api/queue/events');
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(event.data);
            if (data.status === 'MATCHED' && data.sessionId) {
              es.close();
              router.push(`/speed-dating/session/${data.sessionId}`);
            } else if (data.status === 'NOT_WAITING') {
              es.close();
              router.push('/');
            }
          } catch (e) {
            console.error('SSE parse error:', e);
          }
        };

        es.onerror = () => {
          fetch('/api/queue/status')
            .then((r) => r.json())
            .then((statusData) => {
              if (statusData.status === 'MATCHED' && statusData.sessionId) {
                es.close();
                router.push(`/speed-dating/session/${statusData.sessionId}`);
              }
            })
            .catch(() => {});
        };
      } catch (err: unknown) {
        if (!isSubscribed) return;
        setError(err instanceof Error ? err.message : 'Connection error');
      }
    }

    initQueue();

    return () => {
      isSubscribed = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [router]);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleCancel = async () => {
    setCancelling(true);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    try {
      await fetch('/api/queue/leave', { method: 'POST' });
    } catch {
      // Ignore network errors on leave
    } finally {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="app-container">
      <Header isAuthenticated />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 30,
          paddingBottom: 40,
        }}
      >
        <div className="panel" style={{ width: '100%', maxWidth: 420, textAlign: 'center', padding: 30 }}>
          <div
            style={{
              position: 'relative',
              width: 128,
              height: 128,
              margin: '0 auto 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Pulsing rings */}
            {[0, 0.6, 1.2].map((delay) => (
              <span
                key={delay}
                className="pulse-mark"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '2px solid var(--action-primary)',
                  opacity: 0,
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
            <div
              style={{
                position: 'relative',
                width: 76,
                height: 76,
                borderRadius: '50%',
                background: 'var(--brand-gradient)',
                backgroundColor: 'var(--action-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="2" y="6" width="13" height="12" rx="2.5" fill="currentColor" />
                <path
                  d="M17 10.5L21.5 7.2C22 6.85 22.7 7.2 22.7 7.8V16.2C22.7 16.8 22 17.15 21.5 16.8L17 13.5"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>

          <h1 className="type-heading" style={{ fontSize: 23, marginBottom: 8 }}>
            Finding someone for you
          </h1>
          <p className="type-body" style={{ fontSize: 15, marginBottom: 20 }}>
            Matching you on your interests. This usually takes a few seconds.
          </p>

          <div className="type-meta" style={{ marginBottom: 22, fontVariantNumeric: 'tabular-nums' }}>
            {seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`} searching
          </div>

          {error && (
            <div className="form-error" style={{ marginBottom: 20, textAlign: 'left' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="btn btn-outline btn-block"
          >
            {cancelling ? 'Leaving…' : 'Stop searching'}
          </button>
        </div>
      </main>
    </div>
  );
}
