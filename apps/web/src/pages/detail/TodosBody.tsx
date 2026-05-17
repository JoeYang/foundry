import type { Todo, TodoStatus } from '@foundry/shared';
import { useTodos } from '../../api/projects.js';
import { Eyebrow } from '../../components/Eyebrow.js';

const STATUS_ORDER: TodoStatus[] = ['open', 'in_progress', 'done', 'cancelled'];
const STATUS_LABEL: Record<TodoStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export function TodosBody({ slug }: { slug: string }) {
  const { data, isLoading } = useTodos(slug);

  if (isLoading) return <div style={{ color: 'var(--ink-400)', fontSize: 13 }}>Loading…</div>;
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--ink-400)', fontSize: 13, fontStyle: 'italic' }}>No todos recorded.</div>;
  }

  const todos = data as Todo[];
  const grouped = STATUS_ORDER.reduce<Record<TodoStatus, Todo[]>>((acc, s) => {
    acc[s] = todos.filter((t) => t.status === s);
    return acc;
  }, { open: [], in_progress: [], done: [], cancelled: [] });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {STATUS_ORDER.map((status) => {
        const items = grouped[status];
        if (items.length === 0) return null;
        return (
          <div key={status}>
            <div style={{ marginBottom: 10 }}><Eyebrow>{STATUS_LABEL[status]}</Eyebrow></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((t) => (
                <li key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: status === 'done' || status === 'cancelled' ? 'var(--ink-400)' : 'var(--ink-800)' }}>
                  <Checkbox status={status} />
                  <span style={{ textDecoration: status === 'cancelled' ? 'line-through' : 'none' }}>{t.text}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Checkbox({ status }: { status: TodoStatus }) {
  const filled = status === 'done' || status === 'in_progress';
  return (
    <span style={{
      width: 14,
      height: 14,
      border: '1.5px solid',
      borderColor: filled ? 'var(--accent-500)' : 'var(--paper-300)',
      borderRadius: status === 'done' ? '50%' : 3,
      background: filled ? 'var(--accent-500)' : 'transparent',
      flexShrink: 0,
      marginTop: 2,
      display: 'inline-block',
    }} />
  );
}
