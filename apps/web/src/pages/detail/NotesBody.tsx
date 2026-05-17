import type { Note } from '@foundry/shared';
import { useNotes } from '../../api/projects.js';
import { relativeTime } from '../../lib/format.js';

export function NotesBody({ slug }: { slug: string }) {
  const { data, isLoading } = useNotes(slug);

  if (isLoading) return <div style={{ color: 'var(--ink-400)', fontSize: 13 }}>Loading…</div>;
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--ink-400)', fontSize: 13, fontStyle: 'italic' }}>No notes recorded.</div>;
  }

  const notes = data as Note[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {notes.map((n) => (
        <article
          key={n.id}
          style={{
            background: '#fff',
            border: '1px solid var(--paper-200)',
            borderRadius: 6,
            padding: 20,
          }}
        >
          <p style={{ fontSize: 14, color: 'var(--ink-800)', lineHeight: 1.6, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{n.body}</p>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>
            <span>{n.author}</span>
            <span>·</span>
            <span>{relativeTime(n.created_at)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
