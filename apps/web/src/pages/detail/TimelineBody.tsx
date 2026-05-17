import type { ProjectEvent } from '@foundry/shared';
import { useTimeline } from '../../api/projects.js';
import { relativeTime } from '../../lib/format.js';

export function TimelineBody({ slug }: { slug: string }) {
  const { data, isLoading } = useTimeline(slug);

  if (isLoading) return <div style={{ color: 'var(--ink-400)', fontSize: 13 }}>Loading…</div>;
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--ink-400)', fontSize: 13, fontStyle: 'italic' }}>No timeline events recorded.</div>;
  }

  const events = data as ProjectEvent[];

  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {events.map((e, i) => (
        <li key={e.id} style={{ display: 'flex', gap: 16, paddingBottom: 20, position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-500)', marginTop: 3, flexShrink: 0 }} />
            {i < events.length - 1 && (
              <div style={{ width: 1, flex: 1, background: 'var(--paper-200)', marginTop: 4 }} />
            )}
          </div>
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-800)', textTransform: 'capitalize' }}>
                {e.kind.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{relativeTime(e.occurred_at)}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-300)', fontFamily: 'var(--font-mono)' }}>{e.actor}</span>
            </div>
            {Object.keys(e.payload).length > 0 && (
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-600)', fontFamily: 'var(--font-mono)', background: 'var(--paper-50)', padding: '4px 8px', borderRadius: 4 }}>
                {JSON.stringify(e.payload)}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
