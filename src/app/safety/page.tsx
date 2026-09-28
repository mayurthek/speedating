'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';

const RULES = [
  {
    title: '18+ only',
    body: 'Speedating is strictly for adults aged 18 and older. Your date of birth is validated during onboarding. Anyone trying to work around this is permanently banned.',
  },
  {
    title: 'Leave any time',
    body: 'You are always in control. During a date you can press Next to meet someone else, or leave the call entirely. You never owe anyone your time.',
  },
  {
    title: 'Be decent',
    body: 'Harassment, nudity, sexual content, spam and unwanted advances are not allowed. Treat the person on the other side like someone you would actually want to talk to.',
  },
  {
    title: 'Report anything',
    body: 'If something is off, report it. Reports are anonymous and end the date immediately. We review every one of them.',
  },
];

export default function SafetyPage() {
  return (
    <div className="app-container">
      <Header />

      <main style={{ maxWidth: 560, margin: '0 auto', width: '100%', paddingTop: 30, paddingBottom: 40 }}>
        <h1 className="type-heading" style={{ marginBottom: 8 }}>
          Safety &amp; community rules
        </h1>
        <p className="type-body" style={{ fontSize: 15, marginBottom: 24 }}>
          A few ground rules so that three minutes with a stranger is actually worth having.
        </p>

        {/* 18+ banner */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: 6,
            backgroundColor: 'var(--accent-soft)',
            color: 'var(--accent-soft-text)',
            marginBottom: 18,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            You must be 18 or older to use Speedating.
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            This is a moderated space for adults. Minors are not permitted, and we remove
            anyone who tries to join.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {RULES.map((rule) => (
            <div key={rule.title} className="panel" style={{ padding: 18 }}>
              <h2 className="type-section" style={{ fontSize: 16, marginBottom: 6 }}>
                {rule.title}
              </h2>
              <p className="type-body" style={{ fontSize: 14 }}>
                {rule.body}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <Link href="/" className="btn btn-primary btn-block">
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
