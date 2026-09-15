'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';

export default function SafetyPage() {
  return (
    <div className="app-container">
      <Header />

      <main style={{ maxWidth: '580px', margin: '0 auto', width: '100%', paddingBottom: '40px' }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h1 className="type-heading" style={{ marginBottom: '8px' }}>
              Safety & Community Rules
            </h1>
            <p className="type-meta">Our guidelines for respectful 3-minute video dating</p>
          </div>

          <div className="panel-soft">
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>18+ Age Requirement</h3>
            <p className="type-body" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Speedating is strictly for adults aged 18 and older. Date of birth is validated during onboarding. Anyone attempting to bypass this rule will have their account permanently banned.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>Leave Anytime</h3>
            <p className="type-body" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              You are always in control. During any date, you can click &quot;Next&quot; to meet someone else or &quot;Leave&quot; to exit the session immediately.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>Zero Tolerance Policy</h3>
            <p className="type-body" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Harassment, inappropriate content, nudity, spam, and unsolicited behavior are strictly forbidden. Users can report or block anyone at any moment during or after a call.
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <Link href="/" className="btn btn-outline" style={{ width: '100%' }}>
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
