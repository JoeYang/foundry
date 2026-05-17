import type React from 'react';
import { useSearchParams } from 'react-router-dom';

const STATUSES = ['active', 'paused', 'blocked', 'done'] as const;

export function FilterBar({ counts }: { counts: Record<string, number> }) {
  const [params, setParams] = useSearchParams();
  const currentStatus = params.get('status') ?? '';
  const setStatus = (s: string | null) => {
    const next = new URLSearchParams(params);
    if (s) next.set('status', s);
    else next.delete('status');
    setParams(next);
  };
  const total = STATUSES.reduce((a, s) => a + (counts[s] ?? 0), 0);

  return (
    <div style={{
      padding: '16px 32px',
      display: 'flex',
      gap: 16,
      alignItems: 'center',
      borderBottom: '1px solid var(--paper-200)',
      fontSize: 13,
    }}>
      <Chip active={!currentStatus} onClick={() => setStatus(null)}>
        All <Count n={total} />
      </Chip>
      {STATUSES.map((s) => (
        <Chip key={s} active={currentStatus === s} onClick={() => setStatus(s)}>
          {s.charAt(0).toUpperCase() + s.slice(1)} <Count n={counts[s] ?? 0} />
        </Chip>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: '4px 0',
        borderBottom: active ? '1px solid var(--accent-500)' : '1px solid transparent',
        color: active ? 'var(--ink-900)' : 'var(--ink-700)',
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span style={{ color: 'var(--ink-400)', marginLeft: 4 }}>{n}</span>;
}
