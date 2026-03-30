/**
 * MBT State Observer (Oracle)
 *
 * This module observes the actual running system and extracts the current state,
 * then compares it to the model's expected state. It serves as the "oracle" that
 * determines if a test passes or fails.
 *
 * All observer functions are non-throwing — they return observed state values.
 * Only `assertState` throws on mismatch.
 */

import { type Page, type BrowserContext } from '@playwright/test';
import {
  type AppState,
  ActorStates,
  PageStates,
  EntityStates,
} from './models/stateMachine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ObservationResult {
  matches: boolean;
  mismatches: Mismatch[];
  observed: Partial<AppState>;
}

export interface Mismatch {
  dimension: string;   // e.g. "actor", "page", "entity.like"
  expected: string;    // what the model says
  actual: string;      // what the SUT shows
}

// ---------------------------------------------------------------------------
// 1. observeActor
// ---------------------------------------------------------------------------

/**
 * Determine who is currently logged in by inspecting UI elements.
 *
 * Rules (evaluated in order):
 * - Avatar visible + dashboard-link visible  => S_ADMIN
 * - Avatar visible + dashboard-link hidden   => S_USER
 * - Login button visible                     => S_ANON
 */
export async function observeActor(
  page: Page,
): Promise<typeof ActorStates[keyof typeof ActorStates]> {
  const avatar = page.locator('[data-testid="user-avatar"]');
  const dashboardLink = page.locator('[data-testid="dashboard-link"]');
  const loginBtn = page.locator('[data-testid="login-btn"]');

  const avatarVisible = await avatar.isVisible().catch(() => false);
  const dashboardVisible = await dashboardLink.isVisible().catch(() => false);
  const loginVisible = await loginBtn.isVisible().catch(() => false);

  if (avatarVisible && dashboardVisible) {
    return ActorStates.ADMIN;
  }
  if (avatarVisible) {
    return ActorStates.USER;
  }
  if (loginVisible) {
    return ActorStates.ANONYMOUS;
  }

  // Fallback: if nothing is visible (e.g. during page transition), assume anonymous
  return ActorStates.ANONYMOUS;
}

// ---------------------------------------------------------------------------
// 2. observePage
// ---------------------------------------------------------------------------

/**
 * Determine current page from the URL path.
 *
 * Uses the pathname relative to baseURL to map to a PageState.
 */
export async function observePage(
  page: Page,
  baseURL: string,
): Promise<typeof PageStates[keyof typeof PageStates]> {
  const url = page.url();

  // Strip baseURL to get the path
  let path: string;
  try {
    const base = new URL(baseURL);
    const current = new URL(url);
    path = current.pathname.slice(base.pathname.length) || '/';
    // Ensure leading slash
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
  } catch {
    // Fallback: try parsing url directly
    try {
      path = new URL(url).pathname;
    } catch {
      return PageStates.HOME;
    }
  }

  // Remove trailing slash for easier matching (but keep root as "/")
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  // Match routes — order matters (more specific first)
  if (path === '/') return PageStates.HOME;
  if (path === '/blog') return PageStates.BLOG_LIST;
  if (path.startsWith('/blog/')) return PageStates.BLOG_POST;
  if (path === '/portfolio') return PageStates.PORTFOLIO_LIST;
  if (path.startsWith('/portfolio/')) return PageStates.PORTFOLIO_DETAIL;
  if (path === '/resume') return PageStates.RESUME;
  if (path === '/login') return PageStates.LOGIN;
  if (path === '/auth/callback') return PageStates.AUTH_CALLBACK;
  if (path === '/admin') return PageStates.ADMIN_DASHBOARD;
  if (path === '/admin/posts') return PageStates.ADMIN_POSTS;
  if (path === '/admin/posts/new' || path.match(/^\/admin\/posts\/\d+$/)) return PageStates.ADMIN_POST_EDITOR;
  if (path === '/admin/projects') return PageStates.ADMIN_PROJECTS;
  if (path === '/admin/projects/new' || path.match(/^\/admin\/projects\/\d+$/)) return PageStates.ADMIN_PROJECT_EDITOR;
  if (path === '/admin/comments') return PageStates.ADMIN_COMMENTS;
  if (path === '/admin/resume') return PageStates.ADMIN_RESUME;

  // Fallback
  return PageStates.HOME;
}

// ---------------------------------------------------------------------------
// 3. observeLikeState
// ---------------------------------------------------------------------------

/**
 * Look at the like button on a blog post page and determine like state.
 *
 * - Button text contains "Liked" => E_LIKED
 * - Otherwise                              => E_UNLIKED
 */
export async function observeLikeState(
  page: Page,
): Promise<typeof EntityStates.LIKED | typeof EntityStates.UNLIKED> {
  const likeBtn = page.locator('[data-testid="like-btn"]');
  const visible = await likeBtn.isVisible().catch(() => false);

  if (!visible) {
    // No like button present — default to UNLIKED
    return EntityStates.UNLIKED;
  }

  const text = await likeBtn.textContent().catch(() => '');
  if (text && text.includes('Liked')) {
    return EntityStates.LIKED;
  }

  return EntityStates.UNLIKED;
}

// ---------------------------------------------------------------------------
// 4. observeAppState
// ---------------------------------------------------------------------------

/**
 * Combine all observers to build the full observed application state.
 *
 * Entity observations are only collected when the current page makes them
 * relevant (e.g. like state is only observed on a blog post page).
 */
export async function observeAppState(
  page: Page,
  context: BrowserContext,
  baseURL: string,
): Promise<Partial<AppState>> {
  const actor = await observeActor(page);
  const pageState = await observePage(page, baseURL);

  const entity: NonNullable<AppState['entity']> = {};

  if (pageState === PageStates.BLOG_POST) {
    entity.like = await observeLikeState(page);
  }

  return {
    actor,
    page: pageState,
    entity: Object.keys(entity).length > 0 ? entity : undefined,
  };
}

// ---------------------------------------------------------------------------
// 5. compareStates
// ---------------------------------------------------------------------------

/**
 * Compare model expected state with the observed state and produce a result.
 *
 * Only dimensions present in `observed` are compared; absent dimensions are
 * treated as "not observed" and skipped.
 */
export function compareStates(
  expected: AppState,
  observed: Partial<AppState>,
): ObservationResult {
  const mismatches: Mismatch[] = [];

  // Actor
  if (observed.actor !== undefined) {
    if (observed.actor !== expected.actor) {
      mismatches.push({
        dimension: 'actor',
        expected: expected.actor,
        actual: observed.actor,
      });
    }
  }

  // Page
  if (observed.page !== undefined) {
    if (observed.page !== expected.page) {
      mismatches.push({
        dimension: 'page',
        expected: expected.page,
        actual: observed.page,
      });
    }
  }

  // Entity sub-dimensions (only when both sides have data)
  if (expected.entity && observed.entity) {
    // Like
    if (observed.entity.like !== undefined && expected.entity.like !== undefined) {
      if (observed.entity.like !== expected.entity.like) {
        mismatches.push({
          dimension: 'entity.like',
          expected: expected.entity.like,
          actual: observed.entity.like,
        });
      }
    }

    // Post
    if (observed.entity.post !== undefined && expected.entity.post !== undefined) {
      if (observed.entity.post !== expected.entity.post) {
        mismatches.push({
          dimension: 'entity.post',
          expected: expected.entity.post,
          actual: observed.entity.post,
        });
      }
    }

    // Comment
    if (observed.entity.comment !== undefined && expected.entity.comment !== undefined) {
      if (observed.entity.comment !== expected.entity.comment) {
        mismatches.push({
          dimension: 'entity.comment',
          expected: expected.entity.comment,
          actual: observed.entity.comment,
        });
      }
    }

    // Project
    if (observed.entity.project !== undefined && expected.entity.project !== undefined) {
      if (observed.entity.project !== expected.entity.project) {
        mismatches.push({
          dimension: 'entity.project',
          expected: expected.entity.project,
          actual: observed.entity.project,
        });
      }
    }
  }

  return {
    matches: mismatches.length === 0,
    mismatches,
    observed,
  };
}

// ---------------------------------------------------------------------------
// 6. assertState
// ---------------------------------------------------------------------------

/**
 * Convenience function: observe + compare + throw on mismatch.
 *
 * This is the only function in this module that throws.
 */
export async function assertState(
  expected: AppState,
  page: Page,
  context: BrowserContext,
  baseURL: string,
): Promise<void> {
  const observed = await observeAppState(page, context, baseURL);
  const result = compareStates(expected, observed);

  if (!result.matches) {
    const details = result.mismatches
      .map((m) => `${m.dimension}: expected ${m.expected}, got ${m.actual}`)
      .join('; ');
    throw new Error(`State mismatch: ${details}`);
  }
}
