export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div style={{ padding: '64px 32px', textAlign: 'center', color: 'var(--ink-500)' }}>
      <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, marginBottom: 8 }}>{title}</h3>
      {body && <p style={{ maxWidth: 480, margin: '0 auto' }}>{body}</p>}
    </div>
  );
}
