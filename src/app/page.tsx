'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { AuthGateModal } from '@/components/AuthGateModal';
import { Avatar } from '@/components/Avatar';
import { ProfileRecord, PreferenceRecord, UserRecord } from '@/lib/db';

const HOW_IT_WORKS = [
  'Create a free account and add a few interests.',
  'Tap Video and we pair you with someone new.',
  'Both of you get 3 minutes and the same question.',
  'Keep talking, or skip to the next person.',
];

const SAMPLE_INTERESTS = ['Music', 'Travel', 'Food', 'Gaming', 'Art', 'Running'];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [preference, setPreference] = useState<PreferenceRecord | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          if (active) setUser(null);
          return;
        }
        const data = await res.json();
        if (!active) return;
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
    return () => {
      active = false;
    };
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
    router.push('/speed-dating/waiting');
  };

  const interests = profile?.interests?.filter(Boolean) ?? [];

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
          paddingTop: 28,
          paddingBottom: 40,
        }}
      >
        {/* Primary card */}
        <div
          className="panel"
          style={{
            width: '100%',
            maxWidth: 460,
            textAlign: 'center',
            padding: '30px 26px 26px',
            borderRadius: 12,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <h1
            className="type-heading"
            style={{ marginBottom: 10, color: 'var(--text-primary)' }}
          >
            Meet someone new, in three minutes
          </h1>

          <p
            className="type-body"
            style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 22 }}
          >
            Speedating pairs you one-to-one over video. You both get the same question and
            three minutes on the clock — then you decide whether to keep talking.
          </p>

          {/* Interests */}
          <div style={{ marginBottom: 24 }}>
            <div className="type-meta" style={{ marginBottom: 10, letterSpacing: '0.03em' }}>
              {interests.length > 0 ? 'YOUR INTERESTS' : 'INTERESTS HELP US MATCH YOU'}
            </div>
            <div className="tag-row" style={{ justifyContent: 'center' }}>
              {(interests.length > 0 ? interests : SAMPLE_INTERESTS).slice(0, 6).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="type-section" style={{ fontSize: 16, marginBottom: 12, fontWeight: 600 }}>
            Start chatting:
          </div>

          <button
            id="start-video-btn"
            onClick={handleVideoClick}
            className="btn btn-primary btn-large btn-block"
            style={{ fontSize: 18, padding: '15px 20px', borderRadius: 6 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="6" width="13" height="12" rx="2.5" fill="currentColor" />
              <path
                d="M17 10.5L21.5 7.2C22 6.85 22.7 7.2 22.7 7.8V16.2C22.7 16.8 22 17.15 21.5 16.8L17 13.5"
                fill="currentColor"
              />
            </svg>
            Video
          </button>

          <p className="type-meta" style={{ marginTop: 14, fontSize: 12 }}>
            Leave anytime · report anything
          </p>
        </div>

        {/* Account status */}
        {user && (
          <div style={{ width: '100%', maxWidth: 460, marginTop: 18 }}>
            {profileComplete && profile ? (
              <div
                className="panel-soft"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar type={profile.avatar_type || profile.gender} size={40} />
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{profile.first_name}</div>
                    <div className="type-meta">
                      Looking for {preference?.interested_in?.toLowerCase() || 'everyone'}
                    </div>
                  </div>
                </div>
                <Link href="/profile" className="btn btn-outline" style={{ fontSize: 13, padding: '8px 14px' }}>
                  View
                </Link>
              </div>
            ) : (
              <div
                className="panel"
                style={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Finish your profile</div>
                  <p className="type-meta" style={{ fontSize: 13 }}>
                    Add your name, birthday and interests so we can start matching you.
                  </p>
                </div>
                <Link href="/profile/create" className="btn btn-primary btn-block" style={{ fontSize: 14 }}>
                  Complete profile
                </Link>
              </div>
            )}
          </div>
        )}

        {/* How it works */}
        <div
          className="panel"
          style={{ width: '100%', maxWidth: 460, marginTop: 18, textAlign: 'left' }}
        >
          <h2 className="type-section" style={{ marginBottom: 14 }}>
            How it works
          </h2>
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 20, margin: 0 }}>
            {HOW_IT_WORKS.map((step, i) => (
              <li key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* 18+ notice */}
        <div
          style={{
            width: '100%',
            maxWidth: 460,
            marginTop: 18,
            padding: '18px 20px',
            borderRadius: 6,
            backgroundColor: 'var(--accent-soft)',
            color: 'var(--accent-soft-text)',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
            You must be 18 or older to use Speedating.
          </strong>
          We are a moderated community for adults. Harassment, nudity and explicit content are
          not allowed, and anyone can be reported at any time.
        </div>
      </main>

      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <span>© {new Date().getFullYear()} Speedating</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link href="/safety" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Safety &amp; Rules
          </Link>
        </div>
      </footer>

      <AuthGateModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
