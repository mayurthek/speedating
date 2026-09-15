'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';

export default function WaitingQueuePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function initQueue() {
      try {
        // First check session and join queue
        const joinRes = await fetch('/api/queue/join', { method: 'POST' });
        if (!joinRes.ok) {
          const errData = await joinRes.json().catch(() => ({}));
          if (joinRes.status === 401) {
            router.push('/');
            return;
          }
          setError(errData.error || 'Unable to join queue. Ensure your profile is complete.');
          return;
        }

        const joinData = await joinRes.json();
        if (!isSubscribed) return;

        // If matched immediately on join
        if (joinData.status === 'MATCHED' && joinData.sessionId) {
          router.push(`/speed-dating/session/${joinData.sessionId}`);
          return;
        }

        // Subscribe to real-time Server-Sent Events
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
          // Fallback to polling if SSE encounters reconnect
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
        const msg = err instanceof Error ? err.message : 'Connection error';
        setError(msg);
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
      <Header isAuthenticated={true} />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px 10px',
        }}
      >
        <div style={{ maxWidth: '440px', width: '100%' }}>
          <h1 className="type-heading" style={{ marginBottom: '12px' }}>
            Finding someone...
          </h1>

          <p
            className="type-body"
            style={{
              color: 'var(--text-secondary)',
              fontSize: '16px',
              marginBottom: '36px',
              lineHeight: 1.5,
            }}
          >
            We&apos;re looking for someone who matches your preferences.
          </p>

          {/* PRD Section 18: Restrained 1-1.4s pulsing connection mark */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '48px',
              height: '32px',
            }}
          >
            <span
              className="pulse-mark"
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                backgroundColor: 'var(--text-primary)',
                borderRadius: '50%',
              }}
            />
            <span
              className="pulse-mark"
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                backgroundColor: 'var(--text-primary)',
                borderRadius: '50%',
                animationDelay: '0.6s',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--surface-soft)',
                border: '1px solid var(--border-strong)',
                fontSize: '14px',
                marginBottom: '24px',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          <div>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="btn btn-outline"
              style={{ minWidth: '160px', padding: '10px 24px' }}
            >
              {cancelling ? 'Leaving...' : '[ Cancel ]'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
