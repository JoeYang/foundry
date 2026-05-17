import type { DerivedProject } from '../../api/client.js';
import { StatusDot } from '../../components/StatusDot.js';
import { LiveBadge } from '../../components/LiveBadge.js';
import { Eyebrow } from '../../components/Eyebrow.js';
import { NextStepBlock } from '../../components/NextStepBlock.js';
import { relativeTime } from '../../lib/format.js';

export function DetailHeader({ project }: { project: DerivedProject }) {
  return (
    <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--paper-200)', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, margin: 0 }}>{project.name}</h1>
        <LiveBadge live={project.live} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: 'var(--ink-700)' }}>
        <StatusDot status={project.status} />
        {project.status}
        {project.status_note && <span style={{ fontStyle: 'italic', color: 'var(--ink-500)' }}>— {project.status_note}</span>}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-500)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-400)' }}>{project.path}</span>
        {' · updated '}{relativeTime(project.updated_at)}
      </div>

      {project.summary && (
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontStyle: 'italic', color: 'var(--ink-700)', marginTop: 16, maxWidth: '64ch' }}>
          {project.summary}
        </p>
      )}

      {project.goal && (
        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 6 }}><Eyebrow>Goal</Eyebrow></div>
          <div style={{ maxWidth: '64ch', color: 'var(--ink-900)', lineHeight: 1.55 }}>{project.goal}</div>
        </div>
      )}

      {project.next_step && (
        <div style={{ marginTop: 24 }}>
          <NextStepBlock text={project.next_step} />
        </div>
      )}
    </div>
  );
}
