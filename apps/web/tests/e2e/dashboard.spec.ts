import { test, expect } from '@playwright/test';

const API = 'http://localhost:5380';

test('dashboard loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  // Wait for either an h3 (project card) or the empty state heading
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('upserting a project via the API surfaces in the dashboard', async ({ page, request }) => {
  const ts = Date.now();
  const name = `E2E ${ts}`;
  await request.post(`${API}/v1/agent/projects/upsert`, {
    data: {
      path: `/tmp/e2e-${ts}`,
      name,
      summary: 'created via e2e test',
      goal: '',
      tech_stack: [],
      links: {},
      metadata: {},
      actor: 'agent:e2e',
    },
  });

  await page.goto('/');
  await page.reload();
  await expect(page.getByRole('heading', { level: 3, name }).first()).toBeVisible({ timeout: 15_000 });
});

test('search filters the project list', async ({ page, request }) => {
  const ts = Date.now();
  const matchingName = `Findable ${ts}`;
  const unrelatedName = `Other ${ts}`;
  await request.post(`${API}/v1/agent/projects/upsert`, {
    data: {
      path: `/tmp/find-${ts}`,
      name: matchingName,
      summary: 's',
      goal: '',
      tech_stack: [],
      links: {},
      metadata: {},
      actor: 'agent:e2e',
    },
  });
  await request.post(`${API}/v1/agent/projects/upsert`, {
    data: {
      path: `/tmp/other-${ts}`,
      name: unrelatedName,
      summary: 's',
      goal: '',
      tech_stack: [],
      links: {},
      metadata: {},
      actor: 'agent:e2e',
    },
  });

  await page.goto('/');
  await page.getByLabel('search projects').fill('Findable');
  await expect(page.getByRole('heading', { level: 3, name: matchingName }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { level: 3, name: unrelatedName })).not.toBeVisible();
});
