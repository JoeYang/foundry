import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { ProjectCard } from '../../src/components/ProjectCard.js';
import type { DerivedProject } from '../../src/api/client.js';

const sample: DerivedProject = {
  id: '00000000-0000-0000-0000-000000000001',
  path: '/test/foundry',
  slug: 'foundry',
  name: 'foundry',
  summary: 'a registry of projects',
  goal: '',
  status: 'active' as const,
  status_note: null,
  next_step: 'do the thing',
  tech_stack: ['ts', 'pg'],
  links: {},
  metadata: {},
  search_embedding: null,
  pinned: true,
  archived: false,
  needs_review: false,
  user_notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  live: true,
  decay: 'fresh' as const,
};

function renderCard(p = sample) {
  return render(
    <BrowserRouter>
      <ProjectCard project={p} />
    </BrowserRouter>,
  );
}

describe('ProjectCard', () => {
  it('renders name + summary', () => {
    renderCard();
    expect(screen.getByText('foundry')).toBeInTheDocument();
    expect(screen.getByText('a registry of projects')).toBeInTheDocument();
  });

  it('shows live badge when live=true', () => {
    renderCard();
    expect(screen.getByTestId('live-badge')).toBeInTheDocument();
  });

  it('hides live badge when live=false', () => {
    renderCard({ ...sample, live: false });
    expect(screen.queryByTestId('live-badge')).not.toBeInTheDocument();
  });

  it('renders next step block', () => {
    renderCard();
    expect(screen.getByText('Next step')).toBeInTheDocument();
    expect(screen.getByText('do the thing')).toBeInTheDocument();
  });

  it('omits next step block when next_step is null', () => {
    renderCard({ ...sample, next_step: null });
    expect(screen.queryByText('Next step')).not.toBeInTheDocument();
  });

  it('renders tech stack tags', () => {
    renderCard();
    expect(screen.getByText('ts')).toBeInTheDocument();
    expect(screen.getByText('pg')).toBeInTheDocument();
  });

  it('links to /p/:slug', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/p/foundry');
  });

  it('shows pinned eyebrow when pinned=true', () => {
    renderCard();
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('hides pinned eyebrow when pinned=false', () => {
    renderCard({ ...sample, pinned: false });
    expect(screen.queryByText('Pinned')).not.toBeInTheDocument();
  });

  it('shows decay badge when decay=stale', () => {
    renderCard({ ...sample, decay: 'stale' });
    expect(screen.getByTestId('decay-badge-stale')).toBeInTheDocument();
  });
});
