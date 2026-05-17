import { useSearchParams, Link } from 'react-router-dom';

export function TopBar() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const update = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('search', value);
    else next.delete('search');
    setParams(next);
  };
  return (
    <div style={{
      borderBottom: '1px solid var(--paper-200)',
      padding: '14px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <Link to="/" style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500, color: 'var(--ink-900)' }}>
        foundry
      </Link>
      <input
        aria-label="search projects"
        placeholder="Search projects, tags, or content…"
        value={search}
        onChange={(e) => update(e.target.value)}
        style={{
          background: '#fff',
          border: '1px solid var(--paper-200)',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 13,
          color: 'var(--ink-900)',
          width: 280,
          outline: 'none',
        }}
      />
    </div>
  );
}
