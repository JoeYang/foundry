import type { Decision } from '@foundry/shared';
import { useDecisions } from '../../api/projects.js';
import { relativeTime } from '../../lib/format.js';

export function DecisionsBody({ slug }: { slug: string }) {
  const { data, isLoading } = useDecisions(slug);

  if (isLoading) return <div style={{ color: 'var(--ink-400)', fontSize: 13 }}>Loading…</div>;
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--ink-400)', fontSize: 13, fontStyle: 'italic' }}>No decisions recorded.</div>;
  }

  const decisions = data as Decision[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {decisions.map((d) => (
        <article
          key={d.id}
          style={{
            background: '#fff',
            border: '1px solid var(--paper-200)',
            borderRadius: 6,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, margin: 0 }}>
              {d.title}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--ink-400)', flexShrink: 0 }}>{relativeTime(d.made_at)}</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-700)', lineHeight: 1.55, margin: '0 0 8px' }}>{d.rationale}</p>
          {d.superseded_by && (
            <div style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic' }}>superseded</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--ink-300)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{d.made_by}</div>
        </article>
      ))}
    </div>
  );
}
