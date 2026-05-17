import { useParams } from 'react-router-dom';
import { useProject } from '../api/projects.js';
import { TopBar } from '../components/TopBar.js';
import { EmptyState } from '../components/EmptyState.js';
import { DetailHeader } from './detail/DetailHeader.js';
import { TabBar, type Tab } from './detail/TabBar.js';
import { OverviewBody } from './detail/OverviewBody.js';
import { TimelineBody } from './detail/TimelineBody.js';
import { DecisionsBody } from './detail/DecisionsBody.js';
import { TodosBody } from './detail/TodosBody.js';
import { NotesBody } from './detail/NotesBody.js';
import { SideRail } from './detail/SideRail.js';

const VALID_TABS: Tab[] = ['overview', 'timeline', 'decisions', 'todos', 'notes'];

function isValidTab(t: string | undefined): t is Tab {
  return VALID_TABS.includes(t as Tab);
}

export function ProjectDetailPage() {
  const { slug, tab } = useParams<{ slug: string; tab?: string }>();
  const activeTab: Tab = isValidTab(tab) ? tab : 'overview';
  const { data: project, isLoading, error } = useProject(slug);

  if (isLoading) return <EmptyState title="Loading project…" />;
  if (error) return <EmptyState title="Couldn't load project" body="Retrying automatically." />;
  if (!project) return <EmptyState title="Project not found" />;

  return (
    <div>
      <TopBar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        <DetailHeader project={project} />
        <TabBar slug={project.slug} active={activeTab} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 40, alignItems: 'start' }}>
          <main>
            {activeTab === 'overview' && <OverviewBody slug={project.slug} />}
            {activeTab === 'timeline' && <TimelineBody slug={project.slug} />}
            {activeTab === 'decisions' && <DecisionsBody slug={project.slug} />}
            {activeTab === 'todos' && <TodosBody slug={project.slug} />}
            {activeTab === 'notes' && <NotesBody slug={project.slug} />}
          </main>
          <SideRail project={project} />
        </div>
      </div>
    </div>
  );
}
