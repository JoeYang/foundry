import React from 'react';

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ink-500)',
      }}
    >
      {children}
    </span>
  );
}
