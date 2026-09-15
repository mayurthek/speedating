'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { AuthGateModal } from '@/components/AuthGateModal';
import { Avatar } from '@/components/Avatar';
import { ProfileRecord, PreferenceRecord, UserRecord } from '@/lib/db';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [preference, setPreference] = useState<PreferenceRecord | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
          setProfile(data.profile);
          setPreference(data.preference);
          setProfileComplete(Boolean(data.profileComplete));
        } else {
          setUser(null);
        }
      } catch (e) {
        console.error('Error fetching session:', e);
      }
    }
    checkAuth();
  }, []);

  const handleVideoClick = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (!profileComplete) {
      router.push('/profile/create');
      return;
    }

    // In Phase 2: Enter speed dating queue
    router.push('/speed-dating/waiting');
  };

  return (
    <div className="app-container">
      <Header
        isAuthenticated={Boolean(user)}
        userEmail={user?.email}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '30px 10px',
        }}
      >
        <div style={{ marginBottom: '32px' }}>
          <h1 className="type-wordmark" style={{ marginBottom: '12px' }}>
            Speedating
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              color: 'var(--text-secondary)',
              letterSpacing: '-0.01em',
            }}
          >
            {user ? 'ready when you are' : 'meet someone new, briefly'}
          </p>
        </div>

        {/* Primary Video Button per PRD Section 11A */}
        <div style={{ marginBottom: '32px' }}>
          <button
            id="start-video-btn"
            onClick={handleVideoClick}
            className="btn btn-primary btn-large"
            style={{
              minWidth: '220px',
              height: '60px',
              fontSize: '20px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            [ Video ]
          </button>
        </div>

        {/* Authenticated State Details */}
        {user ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              width: '100%',
              maxWidth: '420px',
            }}
          >
            {profileComplete && profile ? (
              <div
                className="panel-soft"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar type={profile.avatar_type || profile.gender} size={42} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{profile.first_name}</div>
                    <div className="type-meta">
                      Looking for: {preference?.interested_in || 'Everyone'}
                    </div>
                  </div>
                </div>

                <Link href="/profile" className="btn btn-subtle" style={{ fontSize: '13px' }}>
                  View profile
                </Link>
              </div>
            ) : (
              <div
                className="panel"
                style={{
                  width: '100%',
                  borderColor: 'var(--border-strong)',
                  backgroundColor: 'var(--surface-primary)',
                  padding: '16px',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                  Profile incomplete
                </div>
                <p className="type-meta" style={{ marginBottom: '12px' }}>
                  Complete your profile before starting speed dating.
                </p>
                <Link
                  href="/profile/create"
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: '14px', padding: '10px' }}
                >
                  [ Complete Profile ]
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="type-meta" style={{ letterSpacing: '0.04em' }}>
            18+ · leave anytime · report anything
          </div>
        )}
      </main>

      {/* Footer info */}
      <footer
        style={{
          paddingTop: '20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}
      >
        <div>Speedating © {new Date().getFullYear()}</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/safety" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Safety & Rules
          </Link>
        </div>
      </footer>

      {/* Auth Gate Modal */}
      <AuthGateModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Phase 1 Completion Informational Modal */}
      {phaseModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          onClick={() => setPhaseModalOpen(false)}
        >
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  display: 'inline-block',
                  padding: '4px 8px',
                  backgroundColor: 'var(--surface-soft)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '10px',
                }}
              >
                PHASE 1 COMPLETE
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '8px' }}>
                Profile Verified & Ready
              </h3>
              <p className="type-meta" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                Your account and profile are fully setup and validated. The live queue and matchmaking system will be unlocked in <strong>Phase 2</strong> according to the PRD specification.
              </p>
            </div>

            <button
              onClick={() => setPhaseModalOpen(false)}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
