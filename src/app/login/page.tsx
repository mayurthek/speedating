'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { AuthForm } from '@/components/AuthForm';

export default function LogInPage() {
  return (
    <div className="app-container">
      <Header />

      <main style={{ maxWidth: '440px', margin: '40px auto 0', width: '100%' }}>
        <div className="panel">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 className="type-heading" style={{ marginBottom: '8px' }}>
              Welcome back
            </h1>
            <p className="type-meta">Speedating is strictly 18+. Instant 3-minute video dates.</p>
          </div>

          <AuthForm mode="login" autoFocus />

          <div
            style={{
              textAlign: 'center',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span className="type-meta">New here? </span>
            <Link href="/signup" className="type-controls" style={{ color: 'var(--text-primary)' }}>
              Create an account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
