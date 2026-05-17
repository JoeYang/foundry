import { useTimeline } from '../../api/projects.js';
import { relativeTime } from '../../lib/format.js';

// Shape returned by GET /v1/projects/:slug/timeline
// The API wraps each entry: { kind, occurred_at, data }
type EventData = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  actor: string;
  occurred_at: string;
};

type TimelineItem = {
  kind: 'event' | 'decision' | 'todo' | 'note';
  occurred_at: string;
  data: Record<string, unknown>;
};

function itemLabel(item: TimelineItem): string {
  if (item.kind === 'event') {
    const eventKind = (item.data as { kind?: string }).kind ?? 'event';
    return eventKind.replace(/_/g, ' ');
  }
  return item.kind;
}

function itemActor(item: TimelineItem): string | undefined {
  return (item.data as { actor?: string }).actor;
}

function itemPayload(item: TimelineItem): Record<string, unknown> | null {
  if (item.kind !== 'event') return null;
  const payload = (item.data as EventData).payload;
  return payload != null && typeof payload === 'object' ? payload : null;
}

function itemId(item: TimelineItem, index: number): string {
  return (item.data as { id?: string }).id ?? `${item.kind}-${index}`;
}

export function TimelineBody({ slug }: { slug: string }) {
  const { data, isLoading } = useTimeline(slug);

  if (isLoading) return <div style={{ color: 'var(--ink-400)', fontSize: 13 }}>Loading…</div>;
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--ink-400)', fontSize: 13, fontStyle: 'italic' }}>No timeline events recorded.</div>;
  }

  const items = data as TimelineItem[];

  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((item, i) => {
        const payload = itemPayload(item);
        return (
          <li key={itemId(item, i)} style={{ display: 'flex', gap: 16, paddingBottom: 20, position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-500)', marginTop: 3, flexShrink: 0 }} />
              {i < items.length - 1 && (
                <div style={{ width: 1, flex: 1, background: 'var(--paper-200)', marginTop: 4 }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-800)', textTransform: 'capitalize' }}>
                  {itemLabel(item)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{relativeTime(item.occurred_at)}</span>
                {itemActor(item) && (
                  <span style={{ fontSize: 11, color: 'var(--ink-300)', fontFamily: 'var(--font-mono)' }}>{itemActor(item)}</span>
                )}
              </div>
              {payload != null && Object.keys(payload).length > 0 && (
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-600)', fontFamily: 'var(--font-mono)', background: 'var(--paper-50)', padding: '4px 8px', borderRadius: 4 }}>
                  {JSON.stringify(payload)}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
