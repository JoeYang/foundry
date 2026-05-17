export function LiveBadge({ live }: { live: boolean }) {
  if (!live) return null;
  return (
    <span
      data-testid="live-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--green-600)',
        background: '#e8f3eb',
        padding: '2px 8px',
        borderRadius: 9999,
        border: '1px solid #c8e0cf',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: 'var(--green-600)' }} />
      live
    </span>
  );
}
