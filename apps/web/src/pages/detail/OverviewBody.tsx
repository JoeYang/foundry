import type { Decision } from '@foundry/shared';
import type { Todo } from '@foundry/shared';
import type { ProjectEvent } from '@foundry/shared';
import { useDecisions, useTodos, useTimeline } from '../../api/projects.js';
import { Eyebrow } from '../../components/Eyebrow.js';
import { relativeTime } from '../../lib/format.js';

export function OverviewBody({ slug }: { slug: string }) {
  const decisions = useDecisions(slug);
  const todos = useTodos(slug);
  const timeline = useTimeline(slug);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <Section title="Recent decisions">
        {decisions.data && decisions.data.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(decisions.data as Decision[]).slice(0, 3).map((d) => (
              <li key={d.id} style={{ fontSize: 14, color: 'var(--ink-800)' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 500 }}>{d.title}</span>
                <span style={{ color: 'var(--ink-400)', fontSize: 12, marginLeft: 8 }}>{relativeTime(d.made_at)}</span>
              </li>
            ))}
          </ul>
        ) : <Muted>No decisions recorded</Muted>}
      </Section>

      <Section title="Open todos">
        {todos.data && todos.data.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(todos.data as Todo[]).filter((t) => t.status === 'open' || t.status === 'in_progress').slice(0, 5).map((t) => (
              <li key={t.id} style={{ fontSize: 14, color: 'var(--ink-800)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.status === 'in_progress' ? 'var(--accent-500)' : 'var(--paper-300)', flexShrink: 0 }} />
                {t.text}
              </li>
            ))}
          </ul>
        ) : <Muted>No open todos</Muted>}
      </Section>

      <Section title="Recent activity">
        {timeline.data && timeline.data.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(timeline.data as ProjectEvent[]).slice(0, 5).map((e) => (
              <li key={e.id} style={{ fontSize: 13, color: 'var(--ink-700)', display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--ink-400)', flexShrink: 0 }}>{relativeTime(e.occurred_at)}</span>
                <span>{e.kind.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        ) : <Muted>No timeline events</Muted>}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}><Eyebrow>{title}</Eyebrow></div>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--ink-400)', fontSize: 13, fontStyle: 'italic' }}>{children}</div>;
}
