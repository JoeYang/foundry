import type { ProjectStatus } from '@foundry/shared';

const COLOR: Record<ProjectStatus, string> = {
  active: 'var(--green-600)',
  paused: 'var(--amber-500)',
  blocked: 'var(--red-500)',
  done: 'var(--teal-500)',
};

export function StatusDot({ status }: { status: ProjectStatus }) {
  return (
    <span
      aria-label={`status: ${status}`}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 9999,
        background: COLOR[status],
      }}
    />
  );
}
