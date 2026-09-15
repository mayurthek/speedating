'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Avatar } from '@/components/Avatar';
import { ProfileRecord, PreferenceRecord, UserRecord } from '@/lib/db';

export default function ProfileViewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [preference, setPreference] = useState<PreferenceRecord | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/');
          return;
        }
        const data = await res.json();
        if (!data.authenticated) {
          router.push('/');
          return;
        }

        setUser(data.user);
        setProfile(data.profile);
        setPreference(data.preference);
        setProfileComplete(Boolean(data.profileComplete));
      } catch (e) {
        console.error('Error loading profile:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  if (loading) {
    return (
      <div className="app-container">
        <Header />
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <span className="ambient-dot" />
          <p className="type-meta" style={{ marginTop: '12px' }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app-container">
        <Header isAuthenticated={true} userEmail={user?.email} />
        <main style={{ maxWidth: '440px', margin: '40px auto 0', width: '100%', textAlign: 'center' }}>
          <div className="panel">
            <h2 className="type-heading" style={{ marginBottom: '8px' }}>No Profile Found</h2>
            <p className="type-meta" style={{ marginBottom: '20px' }}>You have not completed your profile setup yet.</p>
            <Link href="/profile/create" className="btn btn-primary" style={{ width: '100%' }}>
              Create Profile
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header isAuthenticated={true} userEmail={user?.email} />

      <main style={{ maxWidth: '520px', margin: '0 auto', width: '100%', paddingBottom: '40px' }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Avatar type={profile.avatar_type || profile.gender} size={64} />
              <div>
                <h1 className="type-heading">{profile.first_name}</h1>
                <p className="type-meta">
                  {profile.gender} · Born {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            <Link href="/settings" className="btn btn-outline" style={{ fontSize: '13px' }}>
              Edit Profile
            </Link>
          </div>

          {/* Dating Preference */}
          <div className="panel-soft">
            <div className="type-meta" style={{ marginBottom: '4px' }}>Looking for</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{preference?.interested_in || 'Everyone'}</div>
          </div>

          {/* Bio */}
          <div>
            <div className="type-meta" style={{ marginBottom: '6px' }}>About</div>
            <p className="type-body" style={{ fontSize: '15px', whiteSpace: 'pre-wrap' }}>
              {profile.bio || <span style={{ color: 'var(--text-muted)' }}>No bio written yet.</span>}
            </p>
          </div>

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <div>
              <div className="type-meta" style={{ marginBottom: '8px' }}>Interests</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {profile.interests.map((interest: string) => (
                  <span
                    key={interest}
                    style={{
                      backgroundColor: 'var(--surface-soft)',
                      border: '1px solid var(--border-subtle)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                    }}
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Account status */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="type-meta">Status: <strong style={{ color: 'var(--text-primary)' }}>{user?.status}</strong></span>
            <span className="type-meta">Profile: <strong style={{ color: profileComplete ? 'var(--text-primary)' : 'var(--text-muted)' }}>{profileComplete ? 'Complete' : 'Incomplete'}</strong></span>
          </div>
        </div>
      </main>
    </div>
  );
}
