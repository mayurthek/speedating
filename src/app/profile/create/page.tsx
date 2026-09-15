'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { ProfileForm } from '@/components/ProfileForm';
import { UserRecord } from '@/lib/db';

interface InitialProfileData {
  firstName?: string;
  dateOfBirth?: string;
  gender?: 'Man' | 'Woman' | string;
  avatarType?: 'Man' | 'Woman' | 'Other';
  interestedIn?: 'Men' | 'Women' | 'Everyone';
  bio?: string;
  interests?: string[];
}

export default function ProfileCreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [initialData, setInitialData] = useState<InitialProfileData | null>(null);

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
        if (data.profile) {
          setInitialData({
            firstName: data.profile.first_name,
            dateOfBirth: data.profile.date_of_birth,
            gender: data.profile.gender,
            avatarType: data.profile.avatar_type,
            interestedIn: data.preference?.interested_in,
            bio: data.profile.bio,
            interests: data.profile.interests,
          });
        }
      } catch (e) {
        console.error('Error checking user session:', e);
        router.push('/');
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
          <p className="type-meta" style={{ marginTop: '12px' }}>Loading profile setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header isAuthenticated={true} userEmail={user?.email} />

      <main style={{ maxWidth: '520px', margin: '0 auto', width: '100%', paddingBottom: '40px' }}>
        <div className="panel">
          <div style={{ marginBottom: '24px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
              }}
            >
              Step 1 of 1 · Mandatory Setup
            </span>
            <h1 className="type-heading" style={{ marginTop: '4px', marginBottom: '8px' }}>
              Create your profile
            </h1>
            <p className="type-body" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Complete your profile before entering the speed dating queue.
            </p>
          </div>

          <ProfileForm initialData={initialData || undefined} isEditMode={false} />
        </div>
      </main>
    </div>
  );
}
