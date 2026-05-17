import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { DashboardPage } from '../../src/pages/DashboardPage.js';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  it('renders project card from msw mock', async () => {
    renderPage();
    await waitFor(() => {
      // The project name appears as a heading; use role to disambiguate from TopBar brand link
      expect(screen.getByRole('heading', { name: 'foundry' })).toBeInTheDocument();
    });
  });

  it('shows pinned section when project is pinned', async () => {
    renderPage();
    await waitFor(() => {
      // "Pinned" appears as both a section header eyebrow and as the card eyebrow
      expect(screen.getAllByText('Pinned').length).toBeGreaterThan(0);
    });
  });
});
