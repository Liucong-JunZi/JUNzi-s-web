# TASK: Build MBT Adapter Layer (Transition → Playwright Action)

## Context
The MBT framework has a state machine model (`e2e/mbt/models/`) and assertions (`e2e/mbt/assertions/`), but is missing the **adapter** — the layer that maps abstract transition types to concrete Playwright operations on the real SUT.

## What to Create
**File: `/Users/liucong/code/JUNziweb/e2e/mbt/adapter.ts`**

This file maps each `TransitionType` to a concrete Playwright action function. It is the bridge between the abstract model and the real system.

### Interface

```typescript
import { type Page, type BrowserContext } from '@playwright/test';
import { type AppState, ActorStates, PageStates, EntityStates } from './models/stateMachine';
import { type TransitionType } from './models/transitions';

export interface AdapterContext {
  page: Page;
  context: BrowserContext;
  baseURL: string;
  // Runtime state that the adapter tracks
  data: {
    currentPostSlug?: string;
    currentPostId?: number;
    currentCommentId?: number;
    currentProjectId?: number;
    currentResumeId?: number;
  };
}

// Each adapter function:
// 1. Performs the Playwright action on the SUT
// 2. Returns the new model state (what the model expects after this transition)
export type TransitionAdapter = (
  ctx: AdapterContext,
  fromState: AppState
) => Promise<Partial<AppState>>;
```

### Required mappings (one function per TransitionType)

1. **nav** — Navigate to a target page. Accept params: `{ target: PageState }`. Use `page.goto()` with the correct URL for each page state:
   - `P_HOME` → `/`
   - `P_BLOG_LIST` → `/blog`
   - `P_BLOG_POST` → `/blog/{slug}` (needs `data.currentPostSlug`)
   - `P_PORTFOLIO_LIST` → `/portfolio`
   - `P_PORTFOLIO_DETAIL` → `/portfolio/{id}`
   - `P_RESUME` → `/resume`
   - `P_LOGIN` → `/login`
   - `P_ADMIN_DASHBOARD` → `/admin`
   - `P_ADMIN_POSTS` → `/admin/posts`
   - `P_ADMIN_POST_EDITOR` → `/admin/posts/{id}` or `/admin/posts/new`
   - etc.

2. **login** — Only valid for ANONYMOUS actor. Call `/api/auth/test-login` via the browser context's request API to simulate GitHub OAuth login. Use the pattern from `e2e/specs/tpc/helpers.ts:createActorContext`:
   ```typescript
   const res = await ctx.context.request.post('/api/auth/test-login', {
     headers: { 'Content-Type': 'application/json' },
     data: JSON.stringify({ role: 'user' }),
   });
   ```
   Then reload page. Return `{ actor: ActorStates.USER, isAuthenticated: true }`.

3. **logout** — Click logout button (find the logout trigger in UI), or call `/api/auth/logout` via context request. Return `{ actor: ActorStates.ANONYMOUS }`.

4. **like** — Navigate to blog post page first if not there. Click `[data-testid="like-btn"]`. Wait for response. Return `{ entity: { like: EntityStates.LIKED } }`.

5. **unlike** — Same as like but toggles back. Return `{ entity: { like: EntityStates.UNLIKED } }`.

6. **like_denied** — As anonymous, click like button. Expect toast with role="status". Return unchanged state (still unliked).

7. **submit_comment** — Fill `[data-testid="comment-textarea"]` with test text, click `[data-testid="comment-submit-btn"]`. Return `{ entity: { comment: EntityStates.COMMENT_PENDING } }`.

8. **comment_denied** — As anonymous on blog post, verify `[data-testid="comment-login-link"]` is visible. Return unchanged.

9. **load_more_comments** — Click load-more button if present. Return unchanged.

10. **approve_comment** — As admin, navigate to admin comments, click approve for tracked comment. Return `{ entity: { comment: EntityStates.COMMENT_APPROVED } }`.

11. **reject_comment** — Similar to approve. Return `{ entity: { comment: EntityStates.COMMENT_REJECTED } }`.

12. **delete_comment** — As admin, delete tracked comment. Return `{ entity: { comment: EntityStates.COMMENT_NONE } }`.

13. **create_post** — As admin, navigate to `/admin/posts/new`, fill form, submit. Track the new post slug/id. Return `{ page: PageStates.ADMIN_POST_EDITOR, entity: { post: EntityStates.POST_DRAFT } }`.

14. **update_post** — As admin, edit tracked post. Return `{ page: PageStates.ADMIN_POST_EDITOR }`.

15. **delete_post** — As admin, delete tracked post. Return `{ page: PageStates.ADMIN_POSTS }`.

16. **publish_post** — As admin, publish tracked draft. Return `{ entity: { post: EntityStates.POST_PUBLISHED } }`.

17. **create_project** — As admin, create project. Return `{ page: PageStates.ADMIN_PROJECT_EDITOR, entity: { project: EntityStates.PROJECT_PLANNING } }`.

18. **update_project** — As admin, update project. Return `{ page: PageStates.ADMIN_PROJECT_EDITOR }`.

19. **delete_project** — As admin, delete project. Return `{ page: PageStates.ADMIN_PROJECTS }`.

20. **add_resume_item** — As admin, add resume item. Return `{ page: PageStates.ADMIN_RESUME }`.

21. **update_resume_item** — As admin, update resume item. Return `{ page: PageStates.ADMIN_RESUME }`.

22. **delete_resume_item** — As admin, delete resume item. Return `{ page: PageStates.ADMIN_RESUME }`.

23. **403_error** — As user/anon, try to access `/admin`. Expect redirect. Return unchanged.

24. **404_error** — Navigate to non-existent page. Return unchanged.

25. **reload** — `page.reload()`. Return unchanged state.

### Export
```typescript
export const transitionAdapters: Record<TransitionType, TransitionAdapter>;
```

### Important Notes
- Use `data-testid` selectors wherever possible (matching existing test patterns)
- Use Playwright's retry-capable assertions (`await expect(locator).toBeVisible()`)
- Toast notifications should use `page.getByRole('status')` (NOT `getByText()` — strict mode violation)
- For operations that need admin/user auth, assume the actor context is already set up via `openPageAsActor` from `../specs/tpc/helpers`
- Keep functions minimal — just perform the action and return expected state delta
- Import from existing files, don't duplicate
