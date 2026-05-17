import { Link } from 'react-router-dom';
import type { DerivedProject } from '../api/client.js';
import { StatusDot } from './StatusDot.js';
import { LiveBadge } from './LiveBadge.js';
import { DecayBadge } from './DecayBadge.js';
import { TechTag } from './TechTag.js';
import { Eyebrow } from './Eyebrow.js';
import { NextStepBlock } from './NextStepBlock.js';
import { relativeTime } from '../lib/format.js';

export function ProjectCard({ project }: { project: DerivedProject }) {
  return (
    <Link
      to={`/p/${encodeURIComponent(project.slug)}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#fff',
        border: '1px solid var(--paper-200)',
        borderLeft: project.pinned ? '2px solid var(--accent-500)' : '1px solid var(--paper-200)',
        borderRadius: 6,
        padding: 20,
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <div>
        {project.pinned && <div style={{ marginBottom: 4 }}><Eyebrow>Pinned</Eyebrow></div>}
        <h3 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 20,
          fontWeight: 500,
          margin: '0 0 4px',
        }}>{project.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-700)' }}>
          <StatusDot status={project.status} />
          {project.status}
          {project.status_note && <span style={{ fontStyle: 'italic', color: 'var(--ink-500)' }}>— {project.status_note}</span>}
          <LiveBadge live={project.live} />
        </div>
      </div>

      <p style={{ margin: 0, color: 'var(--ink-700)', fontSize: 14, lineHeight: 1.5 }}>{project.summary}</p>

      {project.next_step && <NextStepBlock text={project.next_step} />}

      {project.tech_stack.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {project.tech_stack.map((t) => <TechTag key={t}>{t}</TechTag>)}
        </div>
      )}

      <div style={{
        borderTop: '1px solid var(--paper-200)',
        paddingTop: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: 'var(--ink-500)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{project.path}</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DecayBadge decay={project.decay} />
          {relativeTime(project.updated_at)}
        </span>
      </div>
    </Link>
  );
}
