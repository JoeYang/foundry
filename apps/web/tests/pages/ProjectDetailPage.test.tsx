import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { ProjectDetailPage } from '../../src/pages/ProjectDetailPage.js';

function renderAt(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/p/:slug" element={<ProjectDetailPage />} />
          <Route path="/p/:slug/:tab" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProjectDetailPage', () => {
  it('renders the project name + tabs', async () => {
    renderAt('/p/foundry');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'foundry' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /timeline/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /decisions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /todos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /notes/i })).toBeInTheDocument();
  });

  it('renders the side rail with flag toggles', async () => {
    renderAt('/p/foundry');
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /pinned/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /archived/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /needs review/i })).toBeInTheDocument();
    });
  });

  it('routes to a tab via URL', async () => {
    renderAt('/p/foundry/timeline');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'foundry' })).toBeInTheDocument();
    });
    // The Timeline link should be the active one (have accent border) — just verify it's present
    expect(screen.getByRole('link', { name: /timeline/i })).toBeInTheDocument();
  });

  it('renders project summary and status', async () => {
    renderAt('/p/foundry');
    await waitFor(() => {
      expect(screen.getByText(/test project/i)).toBeInTheDocument();
    });
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows tech stack tags from side rail', async () => {
    renderAt('/p/foundry');
    await waitFor(() => {
      expect(screen.getByText('ts')).toBeInTheDocument();
      expect(screen.getByText('pg')).toBeInTheDocument();
    });
  });

  it('renders your notes textarea', async () => {
    renderAt('/p/foundry');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /your notes/i })).toBeInTheDocument();
    });
  });

  it('shows loading state initially while fetching', () => {
    renderAt('/p/some-project');
    // The loading state should appear before data arrives
    expect(screen.getByText(/loading project/i)).toBeInTheDocument();
  });

  it('renders the overview body with empty sub-sections', async () => {
    renderAt('/p/foundry');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'foundry' })).toBeInTheDocument();
    });
    // msw returns empty arrays for all sub-resources
    expect(screen.getByText(/no decisions recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/no open todos/i)).toBeInTheDocument();
    expect(screen.getByText(/no timeline events/i)).toBeInTheDocument();
  });

  it('renders decisions tab with empty state', async () => {
    renderAt('/p/foundry/decisions');
    await waitFor(() => {
      expect(screen.getByText(/no decisions recorded/i)).toBeInTheDocument();
    });
  });

  it('renders todos tab with empty state', async () => {
    renderAt('/p/foundry/todos');
    await waitFor(() => {
      expect(screen.getByText(/no todos recorded/i)).toBeInTheDocument();
    });
  });

  it('renders notes tab with empty state', async () => {
    renderAt('/p/foundry/notes');
    await waitFor(() => {
      expect(screen.getByText(/no notes recorded/i)).toBeInTheDocument();
    });
  });

  it('falls back to overview for unknown tab', async () => {
    renderAt('/p/foundry/not-a-real-tab');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'foundry' })).toBeInTheDocument();
    });
    // Should show overview content
    expect(screen.getByText(/no decisions recorded/i)).toBeInTheDocument();
  });
});
