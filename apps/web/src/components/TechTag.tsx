import React from 'react';

export function TechTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        padding: '2px 6px',
        border: '1px solid var(--paper-200)',
        borderRadius: 4,
        color: 'var(--ink-700)',
        background: '#fff',
      }}
    >
      {children}
    </span>
  );
}
