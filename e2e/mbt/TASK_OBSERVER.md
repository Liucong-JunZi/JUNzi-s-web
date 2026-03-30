# TASK: Build MBT State Observer (Oracle)

## Context
The MBT framework needs a **state observer** — a module that can look at the actual running system and extract the current state, then compare it to the model's expected state. This is the "oracle" that determines if a test passes or fails.

## What to Create
**File: `/Users/liucong/code/JUNziweb/e2e/mbt/observer.ts`**

### Interface

```typescript
import { type Page, type BrowserContext } from '@playwright/test';
import { type AppState, type StateId, ActorStates, PageStates, EntityStates } from './models/stateMachine';

export interface ObservationResult {
  matches: boolean;
  mismatches: Mismatch[];
  observed: Partial<AppState>;
}

export interface Mismatch {
  dimension: string;    // e.g. "actor", "page", "entity.like"
  expected: string;     // what the model says
  actual: string;       // what the SUT shows
}
```

### Required Functions

#### 1. `observeActor(page: Page): Promise<ActorState>`
Determine who is currently logged in by inspecting the UI:
- If `[data-testid="user-avatar"]` visible AND `[data-testid="dashboard-link"]` visible → `S_ADMIN`
- If `[data-testid="user-avatar"]` visible AND `[data-testid="dashboard-link"]` NOT visible → `S_USER`
- If `[data-testid="login-btn"]` visible → `S_ANON`

#### 2. `observePage(page: Page, baseURL: string): Promise<PageState>`
Determine current page from URL:
- `/` → `P_HOME`
- `/blog` → `P_BLOG_LIST`
- `/blog/:slug` → `P_BLOG_POST`
- `/portfolio` → `P_PORTFOLIO_LIST`
- `/portfolio/:id` → `P_PORTFOLIO_DETAIL`
- `/resume` → `P_RESUME`
- `/login` → `P_LOGIN`
- `/admin` → `P_ADMIN_DASHBOARD`
- `/admin/posts` → `P_ADMIN_POSTS`
- `/admin/posts/new` or `/admin/posts/:id` → `P_ADMIN_POST_EDITOR`
- `/admin/projects` → `P_ADMIN_PROJECTS`
- `/admin/projects/new` or `/admin/projects/:id` → `P_ADMIN_PROJECT_EDITOR`
- `/admin/comments` → `P_ADMIN_COMMENTS`
- `/admin/resume` → `P_ADMIN_RESUME`
- `/auth/callback` → `P_AUTH_CALLBACK`
- anything else → `P_HOME` (fallback)

#### 3. `observeLikeState(page: Page): Promise<'E_LIKED' | 'E_UNLIKED'>`
Look at the like button on a blog post page:
- `[data-testid="like-btn"]` contains text "Liked" → `E_LIKED`
- Otherwise → `E_UNLIKED`

#### 4. `observeAppState(page: Page, context: BrowserContext, baseURL: string): Promise<Partial<AppState>>`
Combine all observers to build the full observed state:
```typescript
const actor = await observeActor(page);
const pageState = await observePage(page, baseURL);
const entity: AppState['entity'] = {};
if (pageState === PageStates.BLOG_POST) {
  entity.like = await observeLikeState(page);
}
return { actor, page: pageState, entity: Object.keys(entity).length ? entity : undefined };
```

#### 5. `compareStates(expected: AppState, observed: Partial<AppState>): ObservationResult`
Compare model expected state with observed state. Return mismatches:
- Compare actor if observed has actor
- Compare page if observed has page
- Compare entity.like if observed has entity.like
- etc.

Each mismatch records the dimension, expected value, and actual value.

#### 6. `assertState(expected: AppState, page: Page, context: BrowserContext, baseURL: string): Promise<void>`
Convenience function that observes + compares + throws on mismatch:
```typescript
const observed = await observeAppState(page, context, baseURL);
const result = compareStates(expected, observed);
if (!result.matches) {
  const details = result.mismatches.map(m => `${m.dimension}: expected ${m.expected}, got ${m.actual}`).join('; ');
  throw new Error(`State mismatch: ${details}`);
}
```

### Existing Assertion Code to Reuse
The file `e2e/mbt/assertions/core.ts` already has `stateInvariants` with functions like `assertAnonymousHeader`, `assertAuthenticatedHeader`, `assertLikedState`, etc. Reuse the selectors from there but make them **return values** instead of asserting.

### Existing State Invariant Map
`e2e/mbt/assertions/core.ts` has `stateInvariantMap` which maps state names to assertion functions. Use the same `data-testid` selectors.

### Important Notes
- All observer functions must be **non-throwing** — they return the observed state, not assert. Only `assertState` throws.
- Use `page.locator().isVisible()` (returns boolean) not `expect(locator).toBeVisible()` (throws).
- Handle pages where certain observations don't apply (e.g., no like button on portfolio page — just skip entity observation).
- Import types from `./models/stateMachine`.
