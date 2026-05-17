import { useState } from 'react';
import type { DerivedProject } from '../../api/client.js';
import { TechTag } from '../../components/TechTag.js';
import { usePatchFlags } from '../../api/projects.js';

export function SideRail({ project }: { project: DerivedProject }) {
  const patch = usePatchFlags(project.slug);
  const [notes, setNotes] = useState(project.user_notes ?? '');

  const toggleFlag = (flag: 'pinned' | 'archived' | 'needs_review') => {
    patch.mutate({ [flag]: !project[flag] });
  };

  const saveNotes = () => {
    if (notes !== (project.user_notes ?? '')) {
      patch.mutate({ user_notes: notes });
    }
  };

  return (
    <aside style={{ borderLeft: '1px solid var(--paper-200)', paddingLeft: 32 }}>
      <Section title="Tech stack">
        {project.tech_stack.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {project.tech_stack.map((t) => <TechTag key={t}>{t}</TechTag>)}
          </div>
        ) : <Muted>none recorded</Muted>}
      </Section>

      <Section title="Links">
        {Object.keys(project.links).length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {Object.entries(project.links).map(([label, url]) => (
              <li key={label} style={{ padding: '4px 0', fontSize: 13 }}>
                <a href={String(url)} target="_blank" rel="noopener noreferrer">↗ {label}</a>
              </li>
            ))}
          </ul>
        ) : <Muted>none recorded</Muted>}
      </Section>

      <Section title="Your flags">
        <FlagRow label="Pinned" value={project.pinned} onToggle={() => toggleFlag('pinned')} />
        <FlagRow label="Needs review" value={project.needs_review} onToggle={() => toggleFlag('needs_review')} />
        <FlagRow label="Archived" value={project.archived} onToggle={() => toggleFlag('archived')} />
      </Section>

      <Section title="Your notes">
        <textarea
          aria-label="your notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          style={{
            width: '100%',
            minHeight: 80,
            background: '#fff',
            border: '1px solid var(--paper-200)',
            borderRadius: 4,
            padding: 8,
            fontSize: 13,
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </Section>

      {Object.keys(project.metadata).length > 0 && (
        <Section title="Metadata (raw)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(project.metadata).map(([k, v]) => (
              <TechTag key={k}>{k}: {String(v)}</TechTag>
            ))}
          </div>
        </Section>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h4 style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-500)', margin: '0 0 8px' }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function FlagRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={onToggle}
        style={{
          width: 28,
          height: 16,
          background: value ? 'var(--accent-500)' : 'var(--paper-200)',
          borderRadius: 9999,
          border: 'none',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 120ms',
        }}
      >
        <span style={{
          width: 12,
          height: 12,
          background: '#fff',
          borderRadius: 9999,
          position: 'absolute',
          top: 2,
          left: value ? 14 : 2,
          transition: 'left 120ms',
        }} />
      </button>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--ink-400)', fontSize: 13, fontStyle: 'italic' }}>{children}</div>;
}
