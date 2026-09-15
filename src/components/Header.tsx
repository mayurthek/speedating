'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  isAuthenticated?: boolean;
  userEmail?: string;
  onOpenAuth?: () => void;
}

export function Header({ isAuthenticated = false, userEmail, onOpenAuth }: HeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '24px',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '40px',
      }}
    >
      <Link
        href="/"
        style={{
          textDecoration: 'none',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Speedating
        </span>
        <span className="ambient-dot" />
      </Link>

      <div style={{ position: 'relative' }} ref={menuRef}>
        {isAuthenticated ? (
          <div>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="btn btn-subtle type-controls"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              style={{ padding: '6px 12px' }}
            >
              Profile / Settings ▾
            </button>

            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  backgroundColor: 'var(--surface-primary)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  minWidth: '160px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {userEmail && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {userEmail}
                  </div>
                )}
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: '10px 14px',
                    fontSize: '14px',
                    textDecoration: 'none',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                  className="btn-subtle"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: '10px 14px',
                    fontSize: '14px',
                    textDecoration: 'none',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                  className="btn-subtle"
                >
                  Settings
                </Link>
                <button
                  role="menuitem"
                  onClick={handleSignOut}
                  style={{
                    padding: '10px 14px',
                    fontSize: '14px',
                    textAlign: 'left',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--action-destructive)',
                  }}
                  className="btn-subtle"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="btn btn-subtle type-controls"
            style={{ padding: '6px 12px' }}
          >
            Log in
          </button>
        )}
      </div>
    </header>
  );
}
