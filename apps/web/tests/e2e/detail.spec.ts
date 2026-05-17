import { test, expect } from '@playwright/test';

const API = 'http://localhost:5380';

test('navigate to project detail and switch tabs', async ({ page, request }) => {
  const ts = Date.now();
  const name = `Detail ${ts}`;
  const upsert = await request.post(`${API}/v1/agent/projects/upsert`, {
    data: {
      path: `/tmp/detail-${ts}`,
      name,
      summary: 'detail test',
      goal: 'verify tabs work',
      next_step: 'click around',
      tech_stack: ['ts'],
      links: {},
      metadata: {},
      actor: 'agent:e2e',
    },
  });
  const project = (await upsert.json()) as { slug: string };

  await page.goto('/');
  await page.reload();
  await page.getByRole('heading', { level: 3, name }).first().click();

  await expect(page).toHaveURL(new RegExp(`/p/${project.slug}$`));
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  // Switch to Timeline tab
  await page.getByRole('link', { name: /timeline/i }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${project.slug}/timeline$`));

  // Switch to Notes tab
  await page.getByRole('link', { name: /notes/i }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${project.slug}/notes$`));
});

test('toggling pinned flag updates UI', async ({ page, request }) => {
  const ts = Date.now();
  const name = `Pin ${ts}`;
  const upsert = await request.post(`${API}/v1/agent/projects/upsert`, {
    data: {
      path: `/tmp/pin-${ts}`,
      name,
      summary: 's',
      goal: '',
      tech_stack: [],
      links: {},
      metadata: {},
      actor: 'agent:e2e',
    },
  });
  const project = (await upsert.json()) as { slug: string; pinned: boolean };

  await page.goto(`/p/${project.slug}`);
  const pinSwitch = page.getByRole('switch', { name: /pinned/i });
  await expect(pinSwitch).toHaveAttribute('aria-checked', String(project.pinned));

  await pinSwitch.click();
  await expect(pinSwitch).toHaveAttribute('aria-checked', String(!project.pinned), { timeout: 5_000 });
});
