import type { Decay } from '@foundry/shared';

export function DecayBadge({ decay }: { decay: Decay }) {
  if (decay === 'fresh') return null;
  return (
    <span
      data-testid={`decay-badge-${decay}`}
      style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '2px 6px',
        borderRadius: 4,
        background: 'var(--paper-200)',
        color: 'var(--ink-500)',
      }}
    >
      {decay}
    </span>
  );
}
