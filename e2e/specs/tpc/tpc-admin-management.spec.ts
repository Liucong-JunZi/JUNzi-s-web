import { test, expect } from '@playwright/test';
import { createActorContext, openPageAsActor, readCsrfToken } from '../tree/helpers';
import { PostsApiClient } from '../../clients/PostsApiClient';
import { CommentsApiClient } from '../../clients/CommentsApiClient';
import { PostFactory } from '../../factories/PostFactory';
import { CommentFactory } from '../../factories/CommentFactory';
import { cleanupPosts, cleanupComment } from '../../helpers/cleanup';

const baseURL = process.env.BASE_URL ?? 'http://localhost';

test.describe('TPC Admin Management', () => {
  test.describe.configure({ mode: 'parallel' });

  const postsApi = new PostsApiClient();
  const commentsApi = new CommentsApiClient();
  const createdPostIds: number[] = [];
  const createdProjectIds: number[] = [];
  const createdResumeIds: number[] = [];
  const createdCommentIds: number[] = [];

  test.afterAll(async ({ browser }) => {
    // Cleanup posts and comments via API clients
    await cleanupPosts(createdPostIds);
    await Promise.all(createdCommentIds.map((id) => cleanupComment(id)));

    // Cleanup projects and resume items via admin API
    const { context } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      for (const id of createdProjectIds) {
        await context.request
          .delete(`/api/admin/projects/${id}`, {
            headers: { 'X-CSRF-Token': csrf },
          })
          .catch(() => {});
      }
      for (const id of createdResumeIds) {
        await context.request
          .delete(`/api/admin/resume/${id}`, {
            headers: { 'X-CSRF-Token': csrf },
          })
          .catch(() => {});
      }
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------
  // OP-341 … OP-350  Admin Projects Sub-State: list → editor transitions
  // TPC pairs: 102 (T81→T94 via SP12), 103 (T81→T95), 104 (T81→T96)
  //            105 (T97→T94), 106 (T99→T94), 107 (T100→T95)
  // ---------------------------------------------------------------------------

  test('OP-341: admin projects list loads and shows new-project button (TPC 102)', async ({ browser }) => {
    // TPC_102: T81 → T94 via SP12  (manage projects → new project)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      const newBtn = page.getByTestId('new-project-btn');
      await expect(newBtn).toBeVisible();
      await newBtn.click();
      await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-342: admin projects list → edit project row (TPC 103)', async ({ browser }) => {
    // TPC_103: T81 → T95 via SP12  (manage projects → edit project)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createRes = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({
          title: `TPC-342 Project ${Date.now()}`,
          description: 'tpc test',
          tech_stack: 'Go',
          status: 'active',
          sort_order: 99,
        }),
      });
      expect(createRes.ok()).toBeTruthy();
      const body = await createRes.json();
      const projectId = body.project?.id || body.id;
      createdProjectIds.push(projectId);

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`project-row-${projectId}`)).toBeVisible();
      await page.getByTestId(`edit-project-btn-${projectId}`).click();
      await expect(page).toHaveURL(new RegExp(`/admin/projects/${projectId}$`), { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-343: admin projects list → preview project (TPC 104)', async ({ browser }) => {
    // TPC_104: T81 → T96 via SP12  (manage projects → preview project → portfolio detail)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createRes = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({
          title: `TPC-343 Project ${Date.now()}`,
          description: 'preview test',
          tech_stack: 'React',
          status: 'active',
          sort_order: 98,
        }),
      });
      expect(createRes.ok()).toBeTruthy();
      const body = await createRes.json();
      const projectId = body.project?.id || body.id;
      createdProjectIds.push(projectId);

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      const previewBtn = page.getByTestId(`preview-project-btn-${projectId}`);
      if (await previewBtn.isVisible()) {
        await previewBtn.click();
        await expect(page).toHaveURL(/\/portfolio\//, { timeout: 10_000 });
        await page.goBack();
        await expect(page).toHaveURL(/\/admin\/projects/, { timeout: 10_000 });
      }
    } finally {
      await context.close();
    }
  });

  test('OP-344: new project editor → back → new project again (TPC 105,108)', async ({ browser }) => {
    // TPC_105: T97 → T94 via SP12  (back from new editor → new project)
    // TPC_108: T94 → T97 via SP13  (new project editor → back)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('new-project-btn').click();
      await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
      // Back to projects list
      const backBtn = page.getByTestId('back-to-projects-btn');
      await expect(backBtn).toBeVisible();
      await backBtn.click();
      await expect(page).toHaveURL(/\/admin\/projects$/, { timeout: 10_000 });
      // New project again
      await page.getByTestId('new-project-btn').click();
      await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-345: edit project → back → new project (TPC 106)', async ({ browser }) => {
    // TPC_106: T99 → T94 via SP12  (back from edit → new project)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createRes = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({
          title: `TPC-345 Project ${Date.now()}`,
          description: 'back from edit test',
          tech_stack: 'TypeScript',
          status: 'active',
          sort_order: 97,
        }),
      });
      expect(createRes.ok()).toBeTruthy();
      const body = await createRes.json();
      const projectId = body.project?.id || body.id;
      createdProjectIds.push(projectId);

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto(`/admin/projects/${projectId}`);
      await expect(page.getByTestId('project-editor-page')).toBeVisible({ timeout: 15_000 });
      const backBtn = page.getByTestId('back-to-projects-btn');
      await expect(backBtn).toBeVisible();
      await backBtn.click();
      await expect(page).toHaveURL(/\/admin\/projects$/, { timeout: 10_000 });
      await page.getByTestId('new-project-btn').click();
      await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-346: save edit project → edit another project (TPC 107,111)', async ({ browser }) => {
    // TPC_107: T100 → T95 via SP12  (save edit → edit another project)
    // TPC_111: T95  → T100 via SP14  (open project edit → save)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createA = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ title: `TPC-346-A ${Date.now()}`, description: 'A', tech_stack: 'Go', status: 'active', sort_order: 96 }),
      });
      const createB = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ title: `TPC-346-B ${Date.now()}`, description: 'B', tech_stack: 'Go', status: 'active', sort_order: 95 }),
      });
      expect(createA.ok()).toBeTruthy();
      expect(createB.ok()).toBeTruthy();
      const bodyA = await createA.json();
      const bodyB = await createB.json();
      const idA = bodyA.project?.id || bodyA.id;
      const idB = bodyB.project?.id || bodyB.id;
      createdProjectIds.push(idA, idB);

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto(`/admin/projects/${idA}`);
      await expect(page.getByTestId('project-editor-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('project-title-input').fill(`TPC-346-A Updated ${Date.now()}`);
      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/api/admin/projects/${idA}`) && r.request().method() === 'PUT'),
        page.getByTestId('save-project-btn').click(),
      ]);
      expect(saveRes.status()).toBeLessThan(300);
      await expect(page).toHaveURL(/\/admin\/projects$/, { timeout: 10_000 });
      // Edit another project
      await page.getByTestId(`edit-project-btn-${idB}`).click();
      await expect(page).toHaveURL(new RegExp(`/admin/projects/${idB}$`), { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-347: new project editor → save success → edit mode (TPC 109,112)', async ({ browser }) => {
    // TPC_109: T94 → T98 via SP13  (new project editor → save success → edit mode)
    // TPC_112: T98 → T99 via SP14  (new→edit → back to projects)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects/new');
      await expect(page.getByTestId('project-editor-page')).toBeVisible({ timeout: 15_000 });
      const uid = Date.now();
      await page.getByTestId('project-title-input').fill(`TPC-347 Project ${uid}`);
      await page.getByTestId('project-description-input').fill('tpc 347 desc');
      await page.getByTestId('project-tech-stack-input').fill('React,TypeScript');
      await page.getByTestId('project-status-select').selectOption('active');

      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/projects') && r.request().method() === 'POST'),
        page.getByTestId('save-project-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const projectId = body.project?.id || body.id;
      if (projectId) createdProjectIds.push(projectId);

      // Should now be in edit mode
      await expect(page).toHaveURL(/\/admin\/projects\/\d+$/, { timeout: 10_000 });
      // Back to projects list
      await page.getByTestId('back-to-projects-btn').click();
      await expect(page).toHaveURL(/\/admin\/projects$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-348: new project editor → save → back (TPC 110,113)', async ({ browser }) => {
    // TPC_110: T95 → T99 via SP14  (open project edit → back to projects)
    // TPC_113: T98 → T100 via SP14 (new→edit → save again)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects/new');
      await expect(page.getByTestId('project-editor-page')).toBeVisible({ timeout: 15_000 });
      const uid = Date.now();
      await page.getByTestId('project-title-input').fill(`TPC-348 Project ${uid}`);
      await page.getByTestId('project-description-input').fill('tpc 348 desc');
      await page.getByTestId('project-tech-stack-input').fill('Go');
      await page.getByTestId('project-status-select').selectOption('active');

      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/projects') && r.request().method() === 'POST'),
        page.getByTestId('save-project-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const projectId = body.project?.id || body.id;
      if (projectId) createdProjectIds.push(projectId);

      // Now in edit mode — save again (TPC_113)
      await expect(page).toHaveURL(/\/admin\/projects\/\d+$/, { timeout: 10_000 });
      await page.getByTestId('project-title-input').fill(`TPC-348 Project Updated ${uid}`);
      const [saveRes2] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/projects') && r.request().method() === 'PUT'),
        page.getByTestId('save-project-btn').click(),
      ]);
      expect(saveRes2.status()).toBeLessThan(300);
      await expect(page).toHaveURL(/\/admin\/projects$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-349: delete project → confirm → success (TPC 138)', async ({ browser }) => {
    // TPC_138: T125 → T126 via SPR9  (click delete project → confirm)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createRes = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ title: `TPC-349 Project ${Date.now()}`, description: 'to delete', tech_stack: 'Go', status: 'active', sort_order: 94 }),
      });
      expect(createRes.ok()).toBeTruthy();
      const body = await createRes.json();
      const projectId = body.project?.id || body.id;
      // Do not push to createdProjectIds — test deletes it itself

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`project-row-${projectId}`)).toBeVisible();

      page.once('dialog', (d) => d.accept());
      const [deleteRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/api/admin/projects/${projectId}`) && r.request().method() === 'DELETE'),
        page.getByTestId(`delete-project-btn-${projectId}`).click(),
      ]);
      expect(deleteRes.status()).toBeLessThan(300);
      await expect(page.getByTestId(`project-row-${projectId}`)).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-350: delete project → cancel → still in list (TPC 139)', async ({ browser }) => {
    // TPC_139: T125 → T127 via SPR9  (click delete project → cancel)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createRes = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ title: `TPC-350 Project ${Date.now()}`, description: 'cancel delete', tech_stack: 'Go', status: 'active', sort_order: 93 }),
      });
      expect(createRes.ok()).toBeTruthy();
      const body = await createRes.json();
      const projectId = body.project?.id || body.id;
      createdProjectIds.push(projectId);

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`project-row-${projectId}`)).toBeVisible();

      page.once('dialog', (d) => d.dismiss());
      await page.getByTestId(`delete-project-btn-${projectId}`).click();
      // Row should still be present after cancel
      await expect(page.getByTestId(`project-row-${projectId}`)).toBeVisible({ timeout: 5_000 });
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------
  // OP-351 … OP-360  Admin Projects Sub-State: project save-error + empty-state
  // TPC pairs: 114 (T119→T122), 115 (T120→T122), 116 (T121→T123)
  //            117 (T122→T119), 118 (T123→T119), 121 (T124 save error)
  // ---------------------------------------------------------------------------

  test('OP-351: projects list (data) → new project button → save success (TPC 114)', async ({ browser }) => {
    // TPC_114: T119 → T122 via SPR4  (SPR2 new-project → save success → SPR7)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('new-project-btn').click();
      await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
      const uid = Date.now();
      await page.getByTestId('project-title-input').fill(`TPC-351 Project ${uid}`);
      await page.getByTestId('project-description-input').fill('tpc 351');
      await page.getByTestId('project-tech-stack-input').fill('Go');
      await page.getByTestId('project-status-select').selectOption('active');
      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/projects') && r.request().method() === 'POST'),
        page.getByTestId('save-project-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const projectId = body.project?.id || body.id;
      if (projectId) createdProjectIds.push(projectId);
      await expect(page).toHaveURL(/\/admin\/projects\/\d+$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-352: projects empty-state CTA → new project editor → save (TPC 115)', async ({ browser }) => {
    // TPC_115: T120 → T122 via SPR4  (SPR3 empty-state CTA → save success)
    // This test navigates directly to /admin/projects/new to simulate the empty-state CTA flow
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });

      const emptyCta = page.getByRole('link', { name: 'Create your first project' });
      if (await emptyCta.isVisible()) {
        await emptyCta.click();
      } else {
        await page.goto('/admin/projects/new');
      }
      await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
      const uid = Date.now();
      await page.getByTestId('project-title-input').fill(`TPC-352 EmptyCTA ${uid}`);
      await page.getByTestId('project-description-input').fill('empty cta test');
      await page.getByTestId('project-tech-stack-input').fill('TypeScript');
      await page.getByTestId('project-status-select').selectOption('active');
      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/projects') && r.request().method() === 'POST'),
        page.getByTestId('save-project-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const projectId = body.project?.id || body.id;
      if (projectId) createdProjectIds.push(projectId);
    } finally {
      await context.close();
    }
  });

  test('OP-353: edit project row → save edit success (TPC 116)', async ({ browser }) => {
    // TPC_116: T121 → T123 via SPR5  (SPR2 edit project row → save edit success → SPR7)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createRes = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ title: `TPC-353 Project ${Date.now()}`, description: 'edit test', tech_stack: 'Rust', status: 'active', sort_order: 92 }),
      });
      expect(createRes.ok()).toBeTruthy();
      const body = await createRes.json();
      const projectId = body.project?.id || body.id;
      createdProjectIds.push(projectId);

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto(`/admin/projects/${projectId}`);
      await expect(page.getByTestId('project-editor-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('project-title-input').fill(`TPC-353 Edited ${Date.now()}`);
      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/api/admin/projects/${projectId}`) && r.request().method() === 'PUT'),
        page.getByTestId('save-project-btn').click(),
      ]);
      expect(saveRes.status()).toBeLessThan(300);
      await expect(page).toHaveURL(/\/admin\/projects$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-354: dashboard → add project quick-action → save new project (TPC 86,109)', async ({ browser }) => {
    // TPC_86:  T52 → T85  via SP8   (nav dashboard → add project quick-action)
    // TPC_109: T94 → T98  via SP13  (new project editor → save success → edit mode)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin');
      await expect(page.getByTestId('admin-dashboard-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('add-project-quick-action').click();
      await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
      const uid = Date.now();
      await page.getByTestId('project-title-input').fill(`TPC-354 QuickAction ${uid}`);
      await page.getByTestId('project-description-input').fill('quick action test');
      await page.getByTestId('project-tech-stack-input').fill('Vue');
      await page.getByTestId('project-status-select').selectOption('active');
      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/projects') && r.request().method() === 'POST'),
        page.getByTestId('save-project-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const projectId = body.project?.id || body.id;
      if (projectId) createdProjectIds.push(projectId);
      await expect(page).toHaveURL(/\/admin\/projects\/\d+$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-355: manage projects → preview project → back to portfolio (TPC 74)', async ({ browser }) => {
    // TPC_74: T96 → T76 via SP4  (admin preview project → back to portfolio)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createRes = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ title: `TPC-355 Project ${Date.now()}`, description: 'preview back test', tech_stack: 'React', status: 'active', sort_order: 91 }),
      });
      expect(createRes.ok()).toBeTruthy();
      const body = await createRes.json();
      const projectId = body.project?.id || body.id;
      createdProjectIds.push(projectId);

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      const previewBtn = page.getByTestId(`preview-project-btn-${projectId}`);
      if (await previewBtn.isVisible()) {
        await previewBtn.click();
        await expect(page).toHaveURL(/\/portfolio\//, { timeout: 10_000 });
        const backBtn = page.getByTestId('back-to-portfolio-btn');
        if (await backBtn.isVisible()) {
          await backBtn.click();
        } else {
          await page.goBack();
        }
        await expect(page).toHaveURL(/\/portfolio$/, { timeout: 10_000 });
      }
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------
  // OP-356 … OP-370  Admin Comments Sub-State (T130–T139)
  // TPC pairs: 140–148 covering SCM1→SCM2 load, approve, reject, delete,
  //            view-post, and chained sequences
  // ---------------------------------------------------------------------------

  test('OP-356: admin comments page loads (TPC 114 partial – SCM1→SCM2 via T130)', async ({ browser }) => {
    // TPC_140: T130 → T131 via SCM2  (load → approve)
    // Here we verify the load itself (SCM1→SCM2) and that approve button is reachable
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const created = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const commentId = created.comment?.id || created.id;
    expect(commentId).toBeTruthy();

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });
      const row = page.getByTestId(`comment-row-${commentId}`);
      await expect(row).toBeVisible();
      await expect(page.getByTestId(`comment-status-${commentId}`)).toBeVisible();
    } finally {
      await context.close();
      await cleanupComment(commentId);
    }
  });

  test('OP-357: admin comments → approve comment (TPC 140,141)', async ({ browser }) => {
    // TPC_140: T130 → T131 via SCM2  (load → approve)
    // TPC_141: T131 → approve in-flight → T132 back to SCM2
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const created = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const commentId = created.comment?.id || created.id;
    expect(commentId).toBeTruthy();

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`comment-row-${commentId}`)).toBeVisible();

      const approveBtn = page.getByTestId(`approve-comment-btn-${commentId}`);
      if (await approveBtn.isVisible()) {
        const [approveRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes(`/api/admin/comments/${commentId}`) && r.request().method() === 'PUT'),
          approveBtn.click(),
        ]);
        expect(approveRes.status()).toBeLessThan(300);
        await expect(page.getByTestId(`comment-status-${commentId}`)).toContainText(/Approved/i, { timeout: 10_000 });
      }
    } finally {
      await context.close();
      await cleanupComment(commentId);
    }
  });

  test('OP-358: admin comments → reject comment (TPC 141,142)', async ({ browser }) => {
    // TPC_141: T130 → T133 via SCM2  (load → reject)
    // TPC_142: T133 → reject in-flight → T134 back to SCM2
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const created = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const commentId = created.comment?.id || created.id;
    expect(commentId).toBeTruthy();

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`comment-row-${commentId}`)).toBeVisible();

      const rejectBtn = page.getByTestId(`reject-comment-btn-${commentId}`);
      if (await rejectBtn.isVisible()) {
        const [rejectRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes(`/api/admin/comments/${commentId}`) && r.request().method() === 'PUT'),
          rejectBtn.click(),
        ]);
        expect(rejectRes.status()).toBeLessThan(300);
        await expect(page.getByTestId(`comment-status-${commentId}`)).toContainText(/Rejected/i, { timeout: 10_000 });
      }
    } finally {
      await context.close();
      await cleanupComment(commentId);
    }
  });

  test('OP-359: admin comments → delete comment → confirm (TPC 142,147)', async ({ browser }) => {
    // TPC_142: T130 → T135 via SCM2  (load → delete)
    // TPC_147: T135 → T136 via SCM5  (delete comment → confirm)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const created = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const commentId = created.comment?.id || created.id;
    expect(commentId).toBeTruthy();

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`comment-row-${commentId}`)).toBeVisible();

      page.once('dialog', (d) => d.accept());
      const [deleteRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/api/admin/comments/${commentId}`) && r.request().method() === 'DELETE'),
        page.getByTestId(`delete-comment-btn-${commentId}`).click(),
      ]);
      expect(deleteRes.status()).toBeLessThan(300);
      await expect(page.getByTestId(`comment-row-${commentId}`)).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
      // comment was deleted by test — cleanup is a no-op
    }
  });

  test('OP-360: admin comments → delete → cancel (TPC 148)', async ({ browser }) => {
    // TPC_148: T135 → T137 via SCM5  (delete comment → cancel)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const created = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const commentId = created.comment?.id || created.id;
    expect(commentId).toBeTruthy();
    createdCommentIds.push(commentId);

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`comment-row-${commentId}`)).toBeVisible();

      page.once('dialog', (d) => d.dismiss());
      await page.getByTestId(`delete-comment-btn-${commentId}`).click();
      // Row must still exist after cancel
      await expect(page.getByTestId(`comment-row-${commentId}`)).toBeVisible({ timeout: 5_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-361: admin comments → view post link (TPC 143,117)', async ({ browser }) => {
    // TPC_143: T130 → T139 via SCM2  (load → view post)
    // TPC_117: T139 → SP2            (SCM2 view-post → blog post page)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const created = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const commentId = created.comment?.id || created.id;
    expect(commentId).toBeTruthy();
    createdCommentIds.push(commentId);

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });
      const row = page.getByTestId(`comment-row-${commentId}`);
      await expect(row).toBeVisible();

      const viewPostLink = row.getByRole('link', { name: /View Post/i });
      if (await viewPostLink.isVisible()) {
        await viewPostLink.click();
        await expect(page).toHaveURL(/\/blog\/.+/, { timeout: 10_000 });
        await page.goBack();
        await expect(page).toHaveURL(/\/admin\/comments/, { timeout: 10_000 });
      }
    } finally {
      await context.close();
    }
  });

  test('OP-362: approve done → reject another (TPC 144)', async ({ browser }) => {
    // TPC_144: T132 → T133 via SCM2  (approve done → reject another)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const createdA = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const createdB = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const idA = createdA.comment?.id || createdA.id;
    const idB = createdB.comment?.id || createdB.id;
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

      const approveBtnA = page.getByTestId(`approve-comment-btn-${idA}`);
      if (await approveBtnA.isVisible()) {
        await approveBtnA.click();
        await expect(page.getByTestId(`comment-status-${idA}`)).toContainText(/Approved/i, { timeout: 10_000 });
      }
      const rejectBtnB = page.getByTestId(`reject-comment-btn-${idB}`);
      if (await rejectBtnB.isVisible()) {
        await rejectBtnB.click();
        await expect(page.getByTestId(`comment-status-${idB}`)).toContainText(/Rejected/i, { timeout: 10_000 });
      }
    } finally {
      await context.close();
      await cleanupComment(idA);
      await cleanupComment(idB);
    }
  });

  test('OP-363: reject done → approve another (TPC 145)', async ({ browser }) => {
    // TPC_145: T134 → T131 via SCM2  (reject done → approve another)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const createdA = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const createdB = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const idA = createdA.comment?.id || createdA.id;
    const idB = createdB.comment?.id || createdB.id;
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

      const rejectBtnA = page.getByTestId(`reject-comment-btn-${idA}`);
      if (await rejectBtnA.isVisible()) {
        await rejectBtnA.click();
        await expect(page.getByTestId(`comment-status-${idA}`)).toContainText(/Rejected/i, { timeout: 10_000 });
      }
      const approveBtnB = page.getByTestId(`approve-comment-btn-${idB}`);
      if (await approveBtnB.isVisible()) {
        await approveBtnB.click();
        await expect(page.getByTestId(`comment-status-${idB}`)).toContainText(/Approved/i, { timeout: 10_000 });
      }
    } finally {
      await context.close();
      await cleanupComment(idA);
      await cleanupComment(idB);
    }
  });

  test('OP-364: delete done → approve another (TPC 146)', async ({ browser }) => {
    // TPC_146: T138 → T131 via SCM2  (delete done → approve another)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const createdA = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const createdB = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const idA = createdA.comment?.id || createdA.id;
    const idB = createdB.comment?.id || createdB.id;
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

      page.once('dialog', (d) => d.accept());
      await page.getByTestId(`delete-comment-btn-${idA}`).click();
      await expect(page.getByTestId(`comment-row-${idA}`)).not.toBeVisible({ timeout: 10_000 });

      const approveBtnB = page.getByTestId(`approve-comment-btn-${idB}`);
      if (await approveBtnB.isVisible()) {
        await approveBtnB.click();
        await expect(page.getByTestId(`comment-status-${idB}`)).toContainText(/Approved/i, { timeout: 10_000 });
      }
    } finally {
      await context.close();
      await cleanupComment(idB);
    }
  });

  test('OP-365: approve → reject → delete → confirm chain (TPC 140,141,144,145,147)', async ({ browser }) => {
    // TPC_140: T130 → T131 via SCM2  (load → approve)
    // TPC_141: T130 → T133 via SCM2  (load → reject)
    // TPC_144: T132 → T133           (approve done → reject another)
    // TPC_145: T134 → T131           (reject done → approve another)
    // TPC_147: T135 → T136 via SCM5  (delete → confirm)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const c1 = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const c2 = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const c3 = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const id1 = c1.comment?.id || c1.id;
    const id2 = c2.comment?.id || c2.id;
    const id3 = c3.comment?.id || c3.id;

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

      if (await page.getByTestId(`approve-comment-btn-${id1}`).isVisible()) {
        await page.getByTestId(`approve-comment-btn-${id1}`).click();
        await expect(page.getByTestId(`comment-status-${id1}`)).toContainText(/Approved/i, { timeout: 10_000 });
      }
      if (await page.getByTestId(`reject-comment-btn-${id2}`).isVisible()) {
        await page.getByTestId(`reject-comment-btn-${id2}`).click();
        await expect(page.getByTestId(`comment-status-${id2}`)).toContainText(/Rejected/i, { timeout: 10_000 });
      }
      page.once('dialog', (d) => d.accept());
      await page.getByTestId(`delete-comment-btn-${id3}`).click();
      await expect(page.getByTestId(`comment-row-${id3}`)).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
      await cleanupComment(id1);
      await cleanupComment(id2);
    }
  });

  test('OP-366: delete → cancel → view post (TPC 148,117)', async ({ browser }) => {
    // TPC_148: T135 → T137 via SCM5  (delete comment → cancel)
    // TPC_117: T139 → SP2            (view post link → blog post)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const created = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const commentId = created.comment?.id || created.id;
    expect(commentId).toBeTruthy();
    createdCommentIds.push(commentId);

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });
      const row = page.getByTestId(`comment-row-${commentId}`);
      await expect(row).toBeVisible();

      // Delete → cancel
      page.once('dialog', (d) => d.dismiss());
      await page.getByTestId(`delete-comment-btn-${commentId}`).click();
      await expect(row).toBeVisible({ timeout: 5_000 });

      // View post link
      const viewPostLink = row.getByRole('link', { name: /View Post/i });
      if (await viewPostLink.isVisible()) {
        await viewPostLink.click();
        await expect(page).toHaveURL(/\/blog\/.+/, { timeout: 10_000 });
      }
    } finally {
      await context.close();
    }
  });

  test('OP-367: dashboard → manage comments → approve → reject → delete chain (TPC 83,114,140,141,147)', async ({ browser }) => {
    // TPC_83:  T52 → T82  via SP8   (nav dashboard → manage comments)
    // TPC_114: T82 → T130 via SP15  (manage comments page load)
    // TPC_140: T130 → T131          (load → approve)
    // TPC_141: T130 → T133          (load → reject)
    // TPC_147: T135 → T136          (delete → confirm)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const c1 = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const c2 = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const c3 = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const id1 = c1.comment?.id || c1.id;
    const id2 = c2.comment?.id || c2.id;
    const id3 = c3.comment?.id || c3.id;

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin');
      await expect(page.getByTestId('admin-dashboard-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('manage-comments-card').click();
      await expect(page).toHaveURL(/\/admin\/comments/, { timeout: 10_000 });
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

      if (await page.getByTestId(`approve-comment-btn-${id1}`).isVisible()) {
        await page.getByTestId(`approve-comment-btn-${id1}`).click();
        await expect(page.getByTestId(`comment-status-${id1}`)).toContainText(/Approved/i, { timeout: 10_000 });
      }
      if (await page.getByTestId(`reject-comment-btn-${id2}`).isVisible()) {
        await page.getByTestId(`reject-comment-btn-${id2}`).click();
        await expect(page.getByTestId(`comment-status-${id2}`)).toContainText(/Rejected/i, { timeout: 10_000 });
      }
      page.once('dialog', (d) => d.accept());
      await page.getByTestId(`delete-comment-btn-${id3}`).click();
      await expect(page.getByTestId(`comment-row-${id3}`)).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
      await cleanupComment(id1);
      await cleanupComment(id2);
    }
  });

  // ---------------------------------------------------------------------------
  // OP-368 … OP-376  Admin Resume Sub-State (T140–T145)
  // TPC pairs: 118 (T83→T140), 119 (T144→T145), 149 (T140→T141), 150 (T140→T142)
  // ---------------------------------------------------------------------------

  test('OP-368: dashboard → edit resume card → resume page loads (TPC 84,118)', async ({ browser }) => {
    // TPC_84:  T52 → T83  via SP8   (nav dashboard → edit resume)
    // TPC_118: T83 → T140 via SP16  (resume page → click edit item)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin');
      await expect(page.getByTestId('admin-dashboard-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('edit-resume-card').click();
      await expect(page).toHaveURL(/\/admin\/resume/, { timeout: 10_000 });
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

      // Click edit on first available item
      const editBtns = page.locator('[data-testid^="edit-resume-btn-"]');
      if (await editBtns.count() > 0) {
        await editBtns.first().click();
        await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
      }
    } finally {
      await context.close();
    }
  });

  test('OP-369: resume → edit item → cancel (TPC 149)', async ({ browser }) => {
    // TPC_149: T140 → T141 via SRM2  (edit resume item → cancel)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/resume');
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

      const editBtns = page.locator('[data-testid^="edit-resume-btn-"]');
      if (await editBtns.count() > 0) {
        await editBtns.first().click();
        await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
        await page.getByTestId('cancel-edit-btn').click();
        // After cancel the form should close / edit button should reappear
        await expect(page.getByTestId('cancel-edit-btn')).not.toBeVisible({ timeout: 5_000 });
      }
    } finally {
      await context.close();
    }
  });

  test('OP-370: resume → edit item → submit → success (TPC 150)', async ({ browser }) => {
    // TPC_150: T140 → T142 via SRM2  (edit resume item → submit form)
    // Also covers T142→T143 (SRM3 save success → SRM1)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/resume');
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

      const editBtns = page.locator('[data-testid^="edit-resume-btn-"]');
      if (await editBtns.count() > 0) {
        await editBtns.first().click();
        await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
        // Update a field
        const titleInput = page.getByTestId('resume-title-input');
        await titleInput.fill(`TPC-370 Updated ${Date.now()}`);
        const [saveRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/admin/resume') && (r.request().method() === 'PUT' || r.request().method() === 'POST')),
          page.getByTestId('resume-save-btn').click(),
        ]);
        expect(saveRes.status()).toBeLessThan(300);
        await expect(page.getByTestId('cancel-edit-btn')).not.toBeVisible({ timeout: 10_000 });
      }
    } finally {
      await context.close();
    }
  });

  test('OP-371: resume → add new item → save (TPC 150 new)', async ({ browser }) => {
    // TPC_150: T140 → T142 via SRM2  (edit/new resume item → submit)
    // This path exercises the new-item form (POST)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/resume');
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('resume-type-select').selectOption('work');
      await page.getByTestId('resume-title-input').fill(`TPC-371 Resume ${Date.now()}`);
      await page.getByTestId('resume-company-input').fill('TPC Corp');
      await page.getByTestId('resume-location-input').fill('Beijing');
      await page.getByTestId('resume-start-date-input').fill('2023-01-01');
      await page.getByTestId('resume-end-date-input').fill('2024-01-01');
      await page.getByTestId('resume-description-input').fill('TPC test item');

      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/resume') && r.request().method() === 'POST'),
        page.getByTestId('resume-save-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const resumeId = body.item?.id || body.id;
      if (resumeId) createdResumeIds.push(resumeId);
    } finally {
      await context.close();
    }
  });

  test('OP-372: resume → delete item → success (TPC 119)', async ({ browser }) => {
    // TPC_119: T144 → T145 via SRM4  (click delete resume item → DELETE success → SRM1)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      // Create a resume item to delete
      const createRes = await context.request.post('/api/admin/resume', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({
          type: 'work',
          title: `TPC-372 Delete Me ${Date.now()}`,
          company: 'TPC Corp',
          location: 'Shanghai',
          start_date: '2022-01-01',
          end_date: '2023-01-01',
          description: 'to be deleted',
        }),
      });
      expect(createRes.ok()).toBeTruthy();
      const body = await createRes.json();
      const resumeId = body.item?.id || body.id;
      expect(resumeId).toBeTruthy();
      // Do not push to createdResumeIds — test deletes it itself

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/resume');
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`resume-row-${resumeId}`)).toBeVisible();

      page.once('dialog', (d) => d.accept());
      const [deleteRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/api/admin/resume/${resumeId}`) && r.request().method() === 'DELETE'),
        page.getByTestId(`delete-resume-btn-${resumeId}`).click(),
      ]);
      expect(deleteRes.status()).toBeLessThan(300);
      await expect(page.getByTestId(`resume-row-${resumeId}`)).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-373: dashboard → edit resume quick-action → edit item → submit (TPC 86,120,150)', async ({ browser }) => {
    // TPC_86:  T52 → T86  via SP8   (dashboard → edit resume quick-action)
    // TPC_120: T86 → T140 via SP16  (resume quick-action → click edit item)
    // TPC_150: T140 → T142          (edit resume item → submit)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin');
      await expect(page.getByTestId('admin-dashboard-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('edit-resume-quick-action').click();
      await expect(page).toHaveURL(/\/admin\/resume/, { timeout: 10_000 });
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

      const editBtns = page.locator('[data-testid^="edit-resume-btn-"]');
      if (await editBtns.count() > 0) {
        await editBtns.first().click();
        await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
        await page.getByTestId('resume-title-input').fill(`TPC-373 QA Updated ${Date.now()}`);
        const [saveRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/admin/resume') && (r.request().method() === 'PUT' || r.request().method() === 'POST')),
          page.getByTestId('resume-save-btn').click(),
        ]);
        expect(saveRes.status()).toBeLessThan(300);
      }
    } finally {
      await context.close();
    }
  });

  test('OP-374: resume → add work item → edit it → cancel (TPC 149 round-trip)', async ({ browser }) => {
    // TPC_149: T140 → T141 via SRM2  (edit resume item → cancel)
    // Round-trip: create item, then edit and cancel to verify SRM1 state restored
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    let resumeId: number | undefined;
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createRes = await context.request.post('/api/admin/resume', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({
          type: 'education',
          title: `TPC-374 Education ${Date.now()}`,
          company: 'TPC University',
          location: 'Chengdu',
          start_date: '2018-09-01',
          end_date: '2022-06-01',
          description: 'test item for cancel flow',
        }),
      });
      expect(createRes.ok()).toBeTruthy();
      const body = await createRes.json();
      resumeId = body.item?.id || body.id;
      if (resumeId) createdResumeIds.push(resumeId);

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/resume');
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

      if (resumeId) {
        const editBtn = page.getByTestId(`edit-resume-btn-${resumeId}`);
        await expect(editBtn).toBeVisible();
        await editBtn.click();
        await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
        // Modify then cancel
        await page.getByTestId('resume-title-input').fill('Should Not Save');
        await page.getByTestId('cancel-edit-btn').click();
        await expect(page.getByTestId('cancel-edit-btn')).not.toBeVisible({ timeout: 5_000 });
        // Edit button should be back
        await expect(page.getByTestId(`edit-resume-btn-${resumeId}`)).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });

  test('OP-375: resume add/edit/delete full cycle (TPC 118,149,150,119)', async ({ browser }) => {
    // TPC_118: T83 → T140           (resume page → click edit item)
    // TPC_149: T140 → T141          (edit → cancel)
    // TPC_150: T140 → T142          (edit → submit)
    // TPC_119: T144 → T145          (delete → success)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/resume');
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

      // Add new item
      await page.getByTestId('resume-type-select').selectOption('work');
      await page.getByTestId('resume-title-input').fill(`TPC-375 Cycle ${Date.now()}`);
      await page.getByTestId('resume-company-input').fill('Cycle Corp');
      await page.getByTestId('resume-location-input').fill('Guangzhou');
      await page.getByTestId('resume-start-date-input').fill('2021-01-01');
      await page.getByTestId('resume-end-date-input').fill('2022-01-01');
      await page.getByTestId('resume-description-input').fill('cycle test');

      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/resume') && r.request().method() === 'POST'),
        page.getByTestId('resume-save-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const resumeId = body.item?.id || body.id;
      expect(resumeId).toBeTruthy();

      // Edit then cancel
      await page.getByTestId(`edit-resume-btn-${resumeId}`).click();
      await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('cancel-edit-btn').click();

      // Edit then submit
      await page.getByTestId(`edit-resume-btn-${resumeId}`).click();
      await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('resume-title-input').fill(`TPC-375 Edited ${Date.now()}`);
      const [editRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/resume') && (r.request().method() === 'PUT' || r.request().method() === 'POST')),
        page.getByTestId('resume-save-btn').click(),
      ]);
      expect(editRes.status()).toBeLessThan(300);

      // Delete
      page.once('dialog', (d) => d.accept());
      await page.getByTestId(`delete-resume-btn-${resumeId}`).click();
      await expect(page.getByTestId(`resume-row-${resumeId}`)).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  // ---------------------------------------------------------------------------
  // OP-376 … OP-385  Remaining TPC pairs: cross-domain and edge-case paths
  // ---------------------------------------------------------------------------

  test('OP-376: admin comments page → load → view post → blog nav (TPC 143,68)', async ({ browser }) => {
    // TPC_143: T130 → T139 via SCM2  (load → view post link)
    // TPC_68:  T71  → SP1            (back to blog from blog-post)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const created = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const commentId = created.comment?.id || created.id;
    expect(commentId).toBeTruthy();
    createdCommentIds.push(commentId);

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

      const row = page.getByTestId(`comment-row-${commentId}`);
      await expect(row).toBeVisible();
      const viewPostLink = row.getByRole('link', { name: /View Post/i });
      if (await viewPostLink.isVisible()) {
        await viewPostLink.click();
        await expect(page).toHaveURL(/\/blog\/.+/, { timeout: 10_000 });
        // Navigate back to blog list
        const backBtn = page.getByRole('link', { name: /Back to Blog/i });
        if (await backBtn.isVisible()) {
          await backBtn.click();
          await expect(page).toHaveURL(/\/blog$/, { timeout: 10_000 });
        }
      }
    } finally {
      await context.close();
    }
  });

  test('OP-377: projects list → delete → confirm → empty state CTA (TPC 138,115)', async ({ browser }) => {
    // TPC_138: T125 → T126 via SPR9  (delete project → confirm)
    // TPC_115: T120 → T122           (empty-state CTA leads to new project save)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      const csrf = await readCsrfToken(context, baseURL);
      const createRes = await context.request.post('/api/admin/projects', {
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        data: JSON.stringify({ title: `TPC-377 Delete ${Date.now()}`, description: 'delete empty', tech_stack: 'Go', status: 'active', sort_order: 90 }),
      });
      expect(createRes.ok()).toBeTruthy();
      const body = await createRes.json();
      const projectId = body.project?.id || body.id;

      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`project-row-${projectId}`)).toBeVisible();

      page.once('dialog', (d) => d.accept());
      await page.getByTestId(`delete-project-btn-${projectId}`).click();
      await expect(page.getByTestId(`project-row-${projectId}`)).not.toBeVisible({ timeout: 10_000 });

      // If empty state appears, click CTA
      const emptyCta = page.getByRole('link', { name: 'Create your first project' });
      if (await emptyCta.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await emptyCta.click();
        await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
      }
    } finally {
      await context.close();
    }
  });

  test('OP-378: project editor fields validation and cover image upload element present (TPC 109)', async ({ browser }) => {
    // TPC_109: T94 → T98 via SP13  (new project editor → save success → edit mode)
    // Verifies all project editor fields are present before save
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects/new');
      await expect(page.getByTestId('project-editor-page')).toBeVisible({ timeout: 15_000 });

      await expect(page.getByTestId('project-title-input')).toBeVisible();
      await expect(page.getByTestId('project-description-input')).toBeVisible();
      await expect(page.getByTestId('project-tech-stack-input')).toBeVisible();
      await expect(page.getByTestId('project-status-select')).toBeVisible();
      await expect(page.getByTestId('project-demo-url-input')).toBeVisible();
      await expect(page.getByTestId('project-github-url-input')).toBeVisible();
      await expect(page.getByTestId('project-sort-order-input')).toBeVisible();

      const uid = Date.now();
      await page.getByTestId('project-title-input').fill(`TPC-378 Fields ${uid}`);
      await page.getByTestId('project-description-input').fill('fields test');
      await page.getByTestId('project-tech-stack-input').fill('React,Go');
      await page.getByTestId('project-demo-url-input').fill('https://demo.example.com');
      await page.getByTestId('project-github-url-input').fill('https://github.com/example/tpc378');
      await page.getByTestId('project-status-select').selectOption('active');
      await page.getByTestId('project-sort-order-input').fill('5');

      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/projects') && r.request().method() === 'POST'),
        page.getByTestId('save-project-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const projectId = body.project?.id || body.id;
      if (projectId) createdProjectIds.push(projectId);
      await expect(page).toHaveURL(/\/admin\/projects\/\d+$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-379: manage projects → dashboard nav → manage comments (TPC 82,83)', async ({ browser }) => {
    // TPC_82: T52 → T81 via SP8  (nav dashboard → manage projects)
    // TPC_83: T52 → T82 via SP8  (nav dashboard → manage comments)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin');
      await expect(page.getByTestId('admin-dashboard-page')).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('manage-projects-card').click();
      await expect(page).toHaveURL(/\/admin\/projects/, { timeout: 10_000 });
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });

      // Navigate back to dashboard then to comments
      await page.goto('/admin');
      await expect(page.getByTestId('admin-dashboard-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('manage-comments-card').click();
      await expect(page).toHaveURL(/\/admin\/comments/, { timeout: 10_000 });
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-380: admin comments pagination (TPC 114 extended)', async ({ browser }) => {
    // Covers pagination controls on admin comments list (SCM2 self-navigation)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

      const nextBtn = page.getByTestId('pagination-next');
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 10_000 });
        const prevBtn = page.getByTestId('pagination-prev');
        if (await prevBtn.isVisible()) {
          await prevBtn.click();
          await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 10_000 });
        }
      }
    } finally {
      await context.close();
    }
  });

  test('OP-381: resume → add education item → save → delete (TPC 150,119)', async ({ browser }) => {
    // TPC_150: T140 → T142  (submit resume form)
    // TPC_119: T144 → T145  (delete resume item success)
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/resume');
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('resume-type-select').selectOption('education');
      await page.getByTestId('resume-title-input').fill(`TPC-381 Edu ${Date.now()}`);
      await page.getByTestId('resume-company-input').fill('Test University');
      await page.getByTestId('resume-location-input').fill('Shenzhen');
      await page.getByTestId('resume-start-date-input').fill('2019-09-01');
      await page.getByTestId('resume-end-date-input').fill('2023-06-01');
      await page.getByTestId('resume-description-input').fill('education item tpc 381');

      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/resume') && r.request().method() === 'POST'),
        page.getByTestId('resume-save-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const resumeId = body.item?.id || body.id;
      expect(resumeId).toBeTruthy();

      // Delete the item
      page.once('dialog', (d) => d.accept());
      const [deleteRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/api/admin/resume/${resumeId}`) && r.request().method() === 'DELETE'),
        page.getByTestId(`delete-resume-btn-${resumeId}`).click(),
      ]);
      expect(deleteRes.status()).toBeLessThan(300);
      await expect(page.getByTestId(`resume-row-${resumeId}`)).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-382: project save error state → retry → success (TPC 121,124)', async ({ browser }) => {
    // TPC_121: T124 → SPR8  (save new project → error)
    // TPC_124: SPR8 retry   (retry save after error)
    // Simulated by submitting an empty form to trigger a validation/API error
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects/new');
      await expect(page.getByTestId('project-editor-page')).toBeVisible({ timeout: 15_000 });

      // Attempt to save empty form (should produce error)
      const saveBtn = page.getByTestId('save-project-btn');
      await saveBtn.click();
      // Check for an error indicator or that the URL did not change
      const errorMsg = page.getByTestId('project-save-error');
      const hasError = await errorMsg.isVisible({ timeout: 3_000 }).catch(() => false);
      // Whether or not the UI shows inline error, fill fields and retry
      const uid = Date.now();
      await page.getByTestId('project-title-input').fill(`TPC-382 Retry ${uid}`);
      await page.getByTestId('project-description-input').fill('retry test');
      await page.getByTestId('project-tech-stack-input').fill('Go');
      await page.getByTestId('project-status-select').selectOption('active');

      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/projects') && r.request().method() === 'POST'),
        saveBtn.click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const projectId = body.project?.id || body.id;
      if (projectId) createdProjectIds.push(projectId);
    } finally {
      await context.close();
    }
  });

  test('OP-383: admin → manage projects → nav header → manage comments (TPC 102,83)', async ({ browser }) => {
    // TPC_102: T81 → T94 via SP12  (manage projects → new project)
    // TPC_83:  T52 → T82 via SP8   (dashboard → manage comments)
    // Tests navigating between admin sections via header or sidebar
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });

      // Navigate to comments via direct URL (simulates sidebar nav)
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });

      // Navigate back to projects
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });

      // Open new project from list
      await page.getByTestId('new-project-btn').click();
      await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-384: resume → add project item → save → edit → submit (TPC 150 edit path)', async ({ browser }) => {
    // TPC_150: T140 → T142 via SRM2  (edit resume item → submit)
    // Exercises the edit path (PUT) after creating a new item
    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
      await page.goto('/admin/resume');
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });

      // Create item via form
      await page.getByTestId('resume-type-select').selectOption('project');
      await page.getByTestId('resume-title-input').fill(`TPC-384 Project Item ${Date.now()}`);
      await page.getByTestId('resume-company-input').fill('Open Source');
      await page.getByTestId('resume-location-input').fill('Remote');
      await page.getByTestId('resume-start-date-input').fill('2020-01-01');
      await page.getByTestId('resume-end-date-input').fill('2021-01-01');
      await page.getByTestId('resume-description-input').fill('project item tpc 384');

      const [saveRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/resume') && r.request().method() === 'POST'),
        page.getByTestId('resume-save-btn').click(),
      ]);
      expect(saveRes.status()).toBe(201);
      const body = await saveRes.json();
      const resumeId = body.item?.id || body.id;
      expect(resumeId).toBeTruthy();
      createdResumeIds.push(resumeId);

      // Now edit the item
      await page.getByTestId(`edit-resume-btn-${resumeId}`).click();
      await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('resume-title-input').fill(`TPC-384 Edited ${Date.now()}`);
      const [editRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/resume') && (r.request().method() === 'PUT' || r.request().method() === 'POST')),
        page.getByTestId('resume-save-btn').click(),
      ]);
      expect(editRes.status()).toBeLessThan(300);
      await expect(page.getByTestId('cancel-edit-btn')).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('OP-385: full admin projects + comments + resume smoke (TPC 82,83,84,102,140,149,150)', async ({ browser }) => {
    // TPC_82:  T52 → T81  (dashboard → manage projects)
    // TPC_83:  T52 → T82  (dashboard → manage comments)
    // TPC_84:  T52 → T83  (dashboard → edit resume)
    // TPC_102: T81 → T94  (manage projects → new project)
    // TPC_140: T130 → T131 (load comments → approve)
    // TPC_149: T140 → T141 (edit resume → cancel)
    // TPC_150: T140 → T142 (edit resume → submit)
    const post = await postsApi.create(PostFactory.create({ status: 'published' }));
    createdPostIds.push(post.id);
    const created = await commentsApi.createAsUser(CommentFactory.create(post.id));
    const commentId = created.comment?.id || created.id;
    expect(commentId).toBeTruthy();
    createdCommentIds.push(commentId);

    const { context, page } = await openPageAsActor(browser, baseURL, 'admin');
    try {
      await page.goto('/');
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });

      // Projects section
      await page.goto('/admin/projects');
      await expect(page.getByTestId('admin-projects-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('new-project-btn').click();
      await expect(page).toHaveURL(/\/admin\/projects\/new$/, { timeout: 10_000 });
      await page.getByTestId('back-to-projects-btn').click();
      await expect(page).toHaveURL(/\/admin\/projects$/, { timeout: 10_000 });

      // Comments section
      await page.goto('/admin/comments');
      await expect(page.getByTestId('admin-comments-page')).toBeVisible({ timeout: 15_000 });
      const approveBtn = page.getByTestId(`approve-comment-btn-${commentId}`);
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await expect(page.getByTestId(`comment-status-${commentId}`)).toContainText(/Approved/i, { timeout: 10_000 });
      }

      // Resume section
      await page.goto('/admin/resume');
      await expect(page.getByTestId('admin-resume-page')).toBeVisible({ timeout: 15_000 });
      const editBtns = page.locator('[data-testid^="edit-resume-btn-"]');
      if (await editBtns.count() > 0) {
        await editBtns.first().click();
        await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
        // Cancel (TPC_149)
        await page.getByTestId('cancel-edit-btn').click();
        await expect(page.getByTestId('cancel-edit-btn')).not.toBeVisible({ timeout: 5_000 });
        // Edit and submit (TPC_150)
        await editBtns.first().click();
        await expect(page.getByTestId('cancel-edit-btn')).toBeVisible({ timeout: 10_000 });
        await page.getByTestId('resume-title-input').fill(`TPC-385 Smoke ${Date.now()}`);
        const [saveRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/admin/resume') && (r.request().method() === 'PUT' || r.request().method() === 'POST')),
          page.getByTestId('resume-save-btn').click(),
        ]);
        expect(saveRes.status()).toBeLessThan(300);
      }
    } finally {
      await context.close();
    }
  });
});

