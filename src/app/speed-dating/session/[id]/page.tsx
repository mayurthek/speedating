'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Avatar } from '@/components/Avatar';

const ROUND_SECONDS = 180;
const POLL_MS = 3000;
const TICK_MS = 250;

type Stage = 'loading' | 'connecting' | 'active' | 'unavailable';

interface Partner {
  firstName: string;
  avatarType: string;
  bio: string | null;
  interests: string[] | null;
}

interface Normalized {
  status: string;
  /** Always a concrete epoch-ms value: falls back to a local 3-minute window. */
  endsAtMs: number;
  question: string | null;
  youDecided: boolean;
}

function toMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function pickString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return null;
}

/**
 * Resolve the round deadline.
 *
 * The server is the source of truth: once the backend returns `endsAt` we use
 * it and are done. Until it does, we keep a locally-derived deadline in
 * sessionStorage so a reload or refresh cannot silently hand the user a fresh
 * three minutes. The server value always wins when present.
 */
function resolveEndsAt(
  raw: Record<string, unknown>,
  session: Record<string, unknown> | null,
  sessionId: string
): number {
  const serverValue =
    toMs(raw.endsAt) ??
    toMs(raw.ends_at) ??
    toMs(session?.endsAt) ??
    toMs(session?.ends_at);

  if (serverValue !== null) return serverValue;

  const key = `speedating:endsAt:${sessionId}`;
  try {
    const stored = Number(window.sessionStorage.getItem(key));
    if (Number.isFinite(stored) && stored > Date.now()) return stored;
    const next = Date.now() + ROUND_SECONDS * 1000;
    window.sessionStorage.setItem(key, String(next));
    return next;
  } catch {
    // Private mode or storage disabled: fall back to a plain local window.
    return Date.now() + ROUND_SECONDS * 1000;
  }
}

/**
 * The session endpoint is owned by the backend workstream and is still being
 * extended (it will gain `endsAt`, the current `question`, and a per-user
 * decision flag). Until then we read defensively so the room is never blank.
 */
function normalize(
  raw: Record<string, unknown>,
  session: Record<string, unknown> | null,
  endsAtMs: number
): Normalized {
  const q = (raw.question ?? session?.question) as Record<string, unknown> | string | undefined;
  const questionText = typeof q === 'string' ? q : pickString(q?.text, q?.prompt, q?.body) ?? null;

  return {
    status: pickString(raw.status, session?.status) ?? 'MATCHED',
    endsAtMs,
    question: questionText,
    youDecided: Boolean(raw.youDecided ?? raw.decided ?? session?.youDecided ?? false),
  };
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionRoomPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [session, setSession] = useState<Normalized | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState<string | null>(null);

  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(ROUND_SECONDS * 1000);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [awaitingPartner, setAwaitingPartner] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' });
        if (cancelled) return;

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error || 'This session is no longer available.');
          setStage('unavailable');
          return;
        }

        const data = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;

        const s = (data.session ?? null) as Record<string, unknown> | null;
        const p = (data.partner ?? null) as Record<string, unknown> | null;

        if (p) {
          setPartner({
            firstName: pickString(p.firstName, p.first_name) ?? 'Someone',
            avatarType: pickString(p.avatarType, p.avatar_type, p.gender) ?? 'Other',
            bio: typeof p.bio === 'string' ? p.bio : null,
            interests: Array.isArray(p.interests) ? (p.interests as string[]) : null,
          });
        }

        const norm = normalize(data, s, resolveEndsAt(data, s, sessionId));

        setSession(norm);
        setDeadlineMs(norm.endsAtMs);

        const status = norm.status.toUpperCase();
        if (status === 'COMPLETED' || status === 'CANCELLED') {
          setStage('unavailable');
          setError(
            status === 'CANCELLED'
              ? 'This date was cancelled.'
              : 'This date has already finished.'
          );
          return;
        }
        setStage(status === 'ACTIVE' ? 'active' : 'connecting');
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load this session.');
        setStage('unavailable');
      }
    }

    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId]);

  // Countdown. The server deadline is the source of truth; we only interpolate
  // locally so the clock animates smoothly between polls.
  useEffect(() => {
    if (deadlineMs === null || stage === 'unavailable') return;
    const id = window.setInterval(() => {
      setRemaining(deadlineMs - Date.now());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [deadlineMs, stage]);

  const leave = () => router.push('/speed-dating/waiting');

  /**
   * Cast a vote for the current round.
   *
   * The server owns the outcome: two people both have to choose "keep talking"
   * for another round to begin. Navigating away unconditionally would throw that
   * away, so we follow the response instead — a completed date exits, a new round
   * resets the clock, and an undecided partner holds us in place.
   */
  const sendDecision = async (decision: 'KEEP' | 'MOVE_ON') => {
    if (deciding) return;
    setDeciding(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });

      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;

      if (!res.ok || !data) {
        // A network or server failure must never trap the user in the room.
        leave();
        return;
      }

      const status = pickString(data.status)?.toUpperCase() ?? '';
      const endsAtMs = toMs(data.endsAt);
      const q = data.question as Record<string, unknown> | string | undefined;
      const questionText =
        typeof q === 'string' ? q : pickString(q?.text, q?.prompt, q?.body);

      if (status === 'COMPLETED' || status === 'CANCELLED') {
        leave();
        return;
      }

      // Both chose to stay: the server opened a fresh round with a new question.
      if (status === 'ACTIVE' && endsAtMs !== null) {
        setAwaitingPartner(false);
        setSession((prev) =>
          prev
            ? { ...prev, status, endsAtMs, question: questionText ?? prev.question, youDecided: false }
            : prev
        );
        setDeadlineMs(endsAtMs);
        setRemaining(endsAtMs - Date.now());
        return;
      }

      // Our vote is recorded; the date now depends on the other person.
      setAwaitingPartner(true);
      setSession((prev) => (prev ? { ...prev, youDecided: true } : prev));
    } catch {
      leave();
    } finally {
      setDeciding(false);
    }
  };

  if (stage === 'loading') {
    return (
      <div className="app-container">
        <Header isAuthenticated />
        <main style={{ textAlign: 'center', paddingTop: 80 }}>
          <div className="spinner spinner--dark" style={{ margin: '0 auto 14px' }} />
          <p className="type-meta">Opening your date…</p>
        </main>
      </div>
    );
  }

  if (stage === 'unavailable') {
    return (
      <div className="app-container">
        <Header isAuthenticated />
        <main style={{ maxWidth: 420, margin: '40px auto 0' }}>
          <div className="panel" style={{ textAlign: 'center' }}>
            <h1 className="type-heading" style={{ marginBottom: 8 }}>
              Date unavailable
            </h1>
            <p className="type-meta" style={{ marginBottom: 20, fontSize: 13 }}>
              {error || 'This session could not be found.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/speed-dating/waiting" className="btn btn-primary btn-block">
                Find someone else
              </Link>
              <Link href="/" className="btn btn-outline btn-block">
                Back to home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const secondsLeft = Math.max(0, Math.ceil(remaining / 1000));
  const progress = Math.max(0, Math.min(100, (remaining / (ROUND_SECONDS * 1000)) * 100));
  const urgent = secondsLeft <= 30;
  const timeUp = secondsLeft <= 0;
  const partnerInterests = partner?.interests?.filter(Boolean) ?? [];

  return (
    <div className="app-container app-container--room">
      <Header isAuthenticated />

      <div className="room">
        <div className="room__stage">
          <div className="room__timer-track" aria-hidden="true">
            <div
              className={`room__timer-bar${urgent ? ' room__timer-bar--urgent' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div
            className={`room__timer${urgent ? ' room__timer--urgent' : ''}`}
            style={{ position: 'absolute', top: 16, right: 16 }}
            role="timer"
            aria-live="off"
          >
            {formatClock(remaining)}
          </div>

          <div className="room__tiles">
            {/* Partner */}
            <div className="room__tile">
              <div className="room__state">
                {stage === 'connecting' ? (
                  <>
                    <div className="spinner" />
                    <div className="room__state-title">Connecting to {partner?.firstName}…</div>
                    <div className="room__state-sub">Setting up the call.</div>
                  </>
                ) : (
                  <>
                    <Avatar type={partner?.avatarType || 'Other'} size={92} onDark />
                    <div className="room__state-title">{partner?.firstName}</div>
                    <div className="room__state-sub">Their video will appear here.</div>
                  </>
                )}
              </div>

              <div className="room__nameplate">
                <span className="status-dot" aria-hidden="true" />
                {partner?.firstName}
              </div>
            </div>

            {/* You */}
            <div className="room__tile room__tile--self">
              <div className="room__state">
                {camOn ? (
                  <>
                    <Avatar type="Other" size={92} onDark />
                    <div className="room__state-title">You</div>
                    <div className="room__state-sub">
                      {micOn ? 'Camera and mic on' : 'You are muted'}
                    </div>
                  </>
                ) : (
                  <>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M3 3l18 18M10.7 6H5a2 2 0 00-2 2v8a2 2 0 002 2h11M21 8.5v7a1.5 1.5 0 01-2.4 1.2L14 13.5"
                        stroke="rgba(255,255,255,0.7)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="room__state-title">You</div>
                    <div className="room__state-sub">Camera off</div>
                  </>
                )}
              </div>

              <div className="room__nameplate">
                <span className="status-dot" aria-hidden="true" />
                You
                {micOn ? null : <span style={{ opacity: 0.65, fontWeight: 400 }}>· muted</span>}
              </div>
            </div>
          </div>

          <p
            className="room__stage-note"
            style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}
          >
            Video and audio are not connected yet — the call surface is ready for the media layer.
          </p>
        </div>

        {/* Shared question */}
        <div className="question">
          <span className="question__label">Question</span>
          <span className="question__text">
            {session?.question ?? 'What is something you recently started that you are really into?'}
          </span>
        </div>

        {/* Controls */}
        <div className="room__controls">
          <button
            className={`control${micOn ? '' : ' control--off'}`}
            onClick={() => setMicOn((v) => !v)}
            aria-pressed={!micOn}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micOn ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                <path
                  d="M5 11a7 7 0 0014 0M12 18v3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 3l18 18M9 6a3 3 0 016 0v5M15 15a3 3 0 01-4.2 2.7M5 11a7 7 0 0010.5 6M19 11a7 7 0 01-.6 3M12 18v3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
            <span className="control__label">{micOn ? 'Mute' : 'Unmute'}</span>
          </button>

          <button
            className={`control${camOn ? '' : ' control--off'}`}
            onClick={() => setCamOn((v) => !v)}
            aria-pressed={!camOn}
            title={camOn ? 'Turn camera off' : 'Turn camera on'}
          >
            {camOn ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="2" y="6" width="13" height="12" rx="2.5" fill="currentColor" />
                <path
                  d="M17 10.5L21.5 7.2C22 6.85 22.7 7.2 22.7 7.8V16.2C22.7 16.8 22 17.15 21.5 16.8L17 13.5"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 3l18 18M10.7 6H5a2 2 0 00-2 2v8a2 2 0 002 2h11"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
            <span className="control__label">{camOn ? 'Camera off' : 'Camera on'}</span>
          </button>

          <button
            className="control control--report"
            onClick={() => (reported ? setShowReport(false) : setShowReport((v) => !v))}
            aria-expanded={showReport}
            title="Report"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 21V4m0 0h11l-2 4 2 4H5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="control__label">Report</span>
          </button>

          <button
            className="control control--next"
            onClick={() => sendDecision('MOVE_ON')}
            disabled={deciding}
            title="Next person"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 5l7 7-7 7M13 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="control__label">Next person</span>
          </button>
        </div>

        {/* Time is up — keep talking or move on */}
        {timeUp && !session?.youDecided && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 20,
            }}
          >
            <div
              className="panel"
              style={{ maxWidth: 380, textAlign: 'center', padding: 26 }}
              role="dialog"
              aria-modal="true"
              aria-label="Time is up"
            >
              <h2 className="type-heading" style={{ fontSize: 21, marginBottom: 8 }}>
                Time&apos;s up
              </h2>
              <p className="type-body" style={{ fontSize: 14, marginBottom: 20 }}>
                Three minutes with {partner?.firstName}. Fancy another three?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => sendDecision('KEEP')}
                  disabled={deciding}
                >
                  Keep talking
                </button>
                <button
                  className="btn btn-outline btn-block"
                  onClick={() => sendDecision('MOVE_ON')}
                  disabled={deciding}
                >
                  Move on
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Waiting on the other person to make the same choice */}
        {awaitingPartner && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 20,
            }}
          >
            <div
              className="panel"
              style={{ maxWidth: 380, textAlign: 'center', padding: 26 }}
              role="status"
            >
              <div className="spinner spinner--dark" style={{ margin: '0 auto 14px' }} />
              <h2 className="type-heading" style={{ fontSize: 21, marginBottom: 8 }}>
                Waiting for {partner?.firstName}
              </h2>
              <p className="type-body" style={{ fontSize: 14, marginBottom: 20 }}>
                You chose to keep talking. This date continues if they do too.
              </p>
              <button className="btn btn-outline btn-block" onClick={leave}>
                Back to matching
              </button>
            </div>
          </div>
        )}

        {/* Report sheet */}
        {showReport && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: 16,
              zIndex: 20,
            }}
            onClick={() => setShowReport(false)}
          >
            <div
              className="panel"
              style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}
              onClick={(e) => e.stopPropagation()}
            >
              {reported ? (
                <>
                  <h2 className="type-heading" style={{ fontSize: 19, marginBottom: 8 }}>
                    Report sent
                  </h2>
                  <p className="type-body" style={{ fontSize: 14, marginBottom: 18 }}>
                    Thanks for telling us. We review every report.
                  </p>
                  <button className="btn btn-primary btn-block" onClick={leave}>
                    Back to matching
                  </button>
                </>
              ) : (
                <>
                  <h2 className="type-heading" style={{ fontSize: 19, marginBottom: 8 }}>
                    Report {partner?.firstName}
                  </h2>
                  <p className="type-body" style={{ fontSize: 14, marginBottom: 16 }}>
                    Reports are anonymous. We end the date and review the session.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      className="btn btn-danger btn-block"
                      onClick={() => {
                        setReported(true);
                        void sendDecision('MOVE_ON');
                      }}
                    >
                      Report and end this date
                    </button>
                    <button
                      className="btn btn-outline btn-block"
                      onClick={() => setShowReport(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Partner context */}
      {(partner?.bio || partnerInterests.length > 0) && (
        <div style={{ maxWidth: 460, margin: '0 auto', padding: '18px 20px 28px', width: '100%' }}>
          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: partner?.bio ? 12 : 0 }}>
              <Avatar type={partner?.avatarType || 'Other'} size={44} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{partner?.firstName}</div>
                <div className="type-meta">In this date with you</div>
              </div>
            </div>
            {partner?.bio && (
              <p className="type-body" style={{ fontSize: 14, marginBottom: partnerInterests.length ? 12 : 0 }}>
                {partner.bio}
              </p>
            )}
            {partnerInterests.length > 0 && (
              <div className="tag-row">
                {partnerInterests.slice(0, 8).map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
