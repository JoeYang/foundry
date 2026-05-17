import { NavLink } from 'react-router-dom';

const TABS = ['overview', 'timeline', 'decisions', 'todos', 'notes'] as const;
export type Tab = (typeof TABS)[number];

export function TabBar({ slug, active }: { slug: string; active: Tab }) {
  return (
    <div style={{
      display: 'flex',
      gap: 24,
      borderBottom: '1px solid var(--paper-200)',
      margin: '24px 0 20px',
    }}>
      {TABS.map((t) => {
        const to = t === 'overview' ? `/p/${encodeURIComponent(slug)}` : `/p/${encodeURIComponent(slug)}/${t}`;
        const isActive = t === active;
        return (
          <NavLink
            key={t}
            to={to}
            end
            style={{
              padding: '8px 0',
              color: isActive ? 'var(--ink-900)' : 'var(--ink-500)',
              borderBottom: isActive ? '2px solid var(--accent-500)' : '2px solid transparent',
              marginBottom: -1,
              textDecoration: 'none',
              fontSize: 14,
              textTransform: 'capitalize',
            }}
          >
            {t}
          </NavLink>
        );
      })}
    </div>
  );
}
