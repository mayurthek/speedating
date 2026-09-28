import React from 'react';

interface AvatarProps {
  type: 'Man' | 'Woman' | 'Other' | string;
  size?: number;
  className?: string;
  /** Renders for placement on a dark background (e.g. the video room). */
  onDark?: boolean;
}

const TONES: Record<string, { bg: string; ring: string; stroke: string }> = {
  woman: { bg: '#FCE4EE', ring: '#E7A3BE', stroke: '#B95277' },
  man: { bg: '#DCEAFB', ring: '#93BCEB', stroke: '#2C6AAC' },
  other: { bg: '#E6E3FB', ring: '#AEA4E8', stroke: '#5F51B4' },
};

const NEUTRAL = { bg: '#EFEAE0', ring: '#CFC4B0', stroke: '#6B6355' };

export function Avatar({ type, size = 48, className = '', onDark = false }: AvatarProps) {
  const normalized = type?.toLowerCase();
  const isWoman = normalized === 'woman';
  const isOther = normalized === 'other';
  const label = isOther ? 'Neutral avatar' : isWoman ? 'Woman avatar' : 'Man avatar';

  const tone = onDark
    ? { bg: 'rgba(255,255,255,0.1)', ring: 'rgba(255,255,255,0.22)', stroke: '#FFFFFF' }
    : TONES[normalized] ?? NEUTRAL;

  return (
    <div
      role="img"
      aria-label={label}
      className={className}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone.bg,
        border: onDark ? '1px solid rgba(255,255,255,0.18)' : `1px solid ${tone.ring}`,
        borderRadius: '50%',
        overflow: 'hidden',
      }}
    >
      <svg
        width={size * 0.72}
        height={size * 0.72}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g stroke={tone.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isOther ? (
            <>
              <circle cx="24" cy="18" r="7" />
              <path d="M12 40C12 32 17 28 24 28C31 28 36 32 36 40" />
              <line x1="24" y1="28" x2="24" y2="33" />
            </>
          ) : isWoman ? (
            <>
              <path d="M16 26C14 22 14 16 20 12C24 9 28 10 30 14C34 18 33 24 32 26" />
              <circle cx="24" cy="20" r="7" />
              <path d="M19 19C19 19 21 21 24 21C27 21 29 19 29 19" />
              <path d="M12 40C12 33 17 30 24 30C31 30 36 33 36 40" />
              <path d="M21 30V34M27 30V34" />
            </>
          ) : (
            <>
              <path d="M17 17C17 13 20 11 24 11C28 11 31 13 31 17" />
              <circle cx="24" cy="20" r="7" />
              <path d="M11 40C11 32 17 29 24 29C31 29 37 32 37 40" />
              <path d="M22 29V33M26 29V33" />
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
