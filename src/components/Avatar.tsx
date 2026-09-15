import React from 'react';

interface AvatarProps {
  type: 'Man' | 'Woman' | 'Other' | string;
  size?: number;
  className?: string;
}

export function Avatar({ type, size = 48, className = '' }: AvatarProps) {
  const normalized = type?.toLowerCase();
  const isWoman = normalized === 'woman';
  const isOther = normalized === 'other';
  const label = isOther ? 'Neutral avatar' : isWoman ? 'Woman avatar' : 'Man avatar';

  return (
    <div
      role="img"
      aria-label={label}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface-soft)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
      className={className}
    >
      <svg
        width={size * 0.75}
        height={size * 0.75}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {isOther ? (
          // Neutral minimalist monochrome avatar for Other
          <g stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="24" cy="18" r="7" />
            <path d="M12 40C12 32 17 28 24 28C31 28 36 32 36 40" />
            <line x1="24" y1="28" x2="24" y2="33" />
          </g>
        ) : isWoman ? (
          // Nostalgic minimalist monochrome woman avatar
          <g stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 26C14 22 14 16 20 12C24 9 28 10 30 14C34 18 33 24 32 26" />
            <circle cx="24" cy="20" r="7" />
            <path d="M19 19C19 19 21 21 24 21C27 21 29 19 29 19" />
            <path d="M12 40C12 33 17 30 24 30C31 30 36 33 36 40" />
            <path d="M21 30V34M27 30V34" />
          </g>
        ) : (
          // Nostalgic minimalist monochrome man avatar
          <g stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 17C17 13 20 11 24 11C28 11 31 13 31 17" />
            <circle cx="24" cy="20" r="7" />
            <path d="M11 40C11 32 17 29 24 29C31 29 37 32 37 40" />
            <path d="M22 29V33M26 29V33" />
          </g>
        )}
      </svg>
    </div>
  );
}
