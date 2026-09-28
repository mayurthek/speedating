'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';

interface AuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
}

export function AuthGateModal({ isOpen, onClose, defaultMode = 'signup' }: AuthGateModalProps) {
  const [isSignUp, setIsSignUp] = useState(defaultMode === 'signup');

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog">
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <span className="tag" style={{ marginBottom: 12, gap: 6, padding: '5px 12px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="6" width="13" height="12" rx="2.5" fill="currentColor" />
              <path
                d="M17 10.5L21.5 7.2C22 6.85 22.7 7.2 22.7 7.8V16.2C22.7 16.8 22 17.15 21.5 16.8L17 13.5"
                fill="currentColor"
              />
            </svg>
            Video date selected
          </span>
          <h2 id="auth-modal-title" className="type-heading" style={{ fontSize: 22, marginBottom: '6px' }}>
            {isSignUp ? 'Sign up to continue' : 'Log in to continue'}
          </h2>
          <p className="type-meta" style={{ fontSize: '13px' }}>
            Speedating is strictly 18+. Instant 3-minute video dates.
          </p>
        </div>

        <AuthForm
          key={isSignUp ? 'signup' : 'login'}
          mode={isSignUp ? 'signup' : 'login'}
          onSuccess={onClose}
        />

        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            marginTop: '20px',
            paddingTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="btn-subtle"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            {isSignUp ? (
              <span>
                Already have an account? <strong style={{ textDecoration: 'underline' }}>Log in</strong>
              </span>
            ) : (
              <span>
                Don&apos;t have an account? <strong style={{ textDecoration: 'underline' }}>Sign up</strong>
              </span>
            )}
          </button>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              style={{ fontSize: '13px', padding: '8px 14px' }}
            >
              Back
            </button>
            <Link
              href={isSignUp ? '/login' : '/signup'}
              className="btn btn-outline"
              style={{ fontSize: '13px', padding: '8px 14px' }}
            >
              Open full page
            </Link>
          </div>

          <div className="type-meta" style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px' }}>
            By continuing, you agree to our 18+ policy, Terms, and Safety Guidelines.
          </div>
        </div>
      </div>
    </div>
  );
}
