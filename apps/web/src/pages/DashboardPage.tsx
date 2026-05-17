import type React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjects } from '../api/projects.js';
import { ProjectCard } from '../components/ProjectCard.js';
import { EmptyState } from '../components/EmptyState.js';
import { TopBar } from '../components/TopBar.js';
import { FilterBar } from '../components/FilterBar.js';
import { Eyebrow } from '../components/Eyebrow.js';

export function DashboardPage() {
  const [params] = useSearchParams();
  const filter = {
    status: params.get('status') ?? undefined,
    search: params.get('search') ?? undefined,
  };

  const { data, isLoading, error } = useProjects(filter as Parameters<typeof useProjects>[0]);

  if (isLoading) return <EmptyState title="Loading projects…" />;
  if (error) return <EmptyState title="Couldn't reach foundry" body="Retrying automatically." />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No projects registered yet"
        body="From a project directory, ask Claude Code to call upsert_project on the foundry MCP server."
      />
    );
  }

  const pinned = data.filter((p) => p.pinned);
  const others = data.filter((p) => !p.pinned);

  return (
    <div>
      <TopBar />
      <FilterBar counts={countByStatus(data)} />
      {pinned.length > 0 && (
        <>
          <SectionHeader>Pinned</SectionHeader>
          <Grid>{pinned.map((p) => <ProjectCard key={p.id} project={p} />)}</Grid>
        </>
      )}
      <SectionHeader>All projects</SectionHeader>
      <Grid>{others.map((p) => <ProjectCard key={p.id} project={p} />)}</Grid>
    </div>
  );
}

function countByStatus(projects: { status: string }[]) {
  return projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '24px 32px 12px' }}><Eyebrow>{children}</Eyebrow></div>;
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '0 32px 32px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16,
    }}>
      {children}
    </div>
  );
}
