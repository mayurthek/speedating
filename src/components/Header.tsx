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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link href="/" className="brand" aria-label="Speedating home">
          <span className="brand__mark" aria-hidden="true">
            S
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span>Speedating</span>
            <span className="brand__sub">3-minute video dates</span>
          </span>
        </Link>

        <div style={{ position: 'relative' }} ref={menuRef}>
          {isAuthenticated ? (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="btn btn-subtle type-controls"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              style={{ padding: '7px 10px', gap: '8px' }}
            >
              <span className="status-dot" aria-hidden="true" />
              <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail || 'My account'}
              </span>
              <span aria-hidden="true" style={{ opacity: 0.6, fontSize: 10 }}>
                ▾
              </span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href="/login" className="btn btn-subtle type-controls">
                Log in
              </Link>
              <button onClick={onOpenAuth} className="btn btn-primary" style={{ fontSize: 14, padding: '9px 16px' }}>
                Sign up
              </button>
            </div>
          )}

          {isAuthenticated && menuOpen && (
            <div className="menu" role="menu">
              {userEmail && <div className="menu__header">{userEmail}</div>}
              <Link href="/profile" role="menuitem" onClick={() => setMenuOpen(false)} className="menu__item">
                My profile
              </Link>
              <Link href="/settings" role="menuitem" onClick={() => setMenuOpen(false)} className="menu__item">
                Settings
              </Link>
              <Link href="/safety" role="menuitem" onClick={() => setMenuOpen(false)} className="menu__item">
                Safety &amp; rules
              </Link>
              <button role="menuitem" onClick={handleSignOut} className="menu__item menu__item--danger">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
