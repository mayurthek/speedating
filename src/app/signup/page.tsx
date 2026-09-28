'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { AuthForm } from '@/components/AuthForm';

export default function SignUpPage() {
  return (
    <div className="app-container">
      <Header />

      <main style={{ maxWidth: '440px', margin: '40px auto 0', width: '100%' }}>
        <div className="panel">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 className="type-heading" style={{ marginBottom: '8px' }}>
              Create Account
            </h1>
            <p className="type-meta">Speedating is strictly 18+. No photos, no profiles to fuss over.</p>
          </div>

          <AuthForm mode="signup" autoFocus />

          <div
            style={{
              textAlign: 'center',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span className="type-meta">Already have an account? </span>
            <Link href="/login" className="type-controls" style={{ color: 'var(--text-primary)' }}>
              Log in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
