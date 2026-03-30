# Assertion Model for TPC Tests

## Overview

This document defines the **state invariants** (what must be true in each state) and **transition postconditions** (what must change after each transition) for every FSM state and transition.

## Why This Exists

TPC (Transition Pair Coverage) guarantees every pair of consecutive transitions is exercised by at least one test path. However, TPC does NOT guarantee assertion quality. This model defines WHAT to assert after each transition, closing the "oracle gap" in model-based testing.

## State Invariants

### S_ANON: Anonymous User
- `login-btn` visible in header
- `user-avatar` NOT visible in header
- `dashboard-link` NOT visible in header

### S_USER: Authenticated User
- `user-avatar` visible in header
- `login-btn` NOT visible in header (or hidden behind mobile menu)
- Can submit comments (comment-textarea visible)
- Can like posts

### S_ADMIN: Admin User
- `user-avatar` visible
- `dashboard-link` visible
- Can access /admin/* routes
- Can CRUD posts, projects, comments, resume

### S_BLOG_LIST: Blog Listing Page
- `blog-page` visible
- `blog-search-input` visible
- At least 1 `post-card` visible (if posts exist)

### S_BLOG_POST: Blog Post Page
- `post-title` visible
- `like-btn` visible with format /Like \(\d+\)/
- `comments-section` visible
- If authenticated: `comment-textarea` and `comment-submit-btn` visible
- If anonymous: `comment-login-link` visible

### S_ADMIN_DASHBOARD: Admin Dashboard
- `admin-dashboard` visible
- All quick actions visible: create-post-action, manage-projects-action (etc.)
- All nav cards visible: manage-posts-action, manage-projects-action, manage-comments-action, edit-resume-action

### S_ADMIN_POSTS: Admin Posts List
- `admin-posts-page` visible
- `new-post-btn` visible
- At least 1 `[data-testid^="post-row"]` (if posts exist)

### S_ADMIN_COMMENTS: Admin Comments
- `admin-comments-page` visible
- Each comment has: comment-row-{id}, comment-status-{id}, approve/reject/delete buttons
- Status values: "Pending", "Approved", "Rejected"

## Transition Postconditions

### Like (T_like)
- BEFORE: like count = N
- AFTER: like count = N + 1 (no toggle, only increment)
- BUTTON TEXT: `Like (${N+1})`

### Submit Comment (T_comment)
- AFTER: toast shows "pending review" message
- AFTER: comment does NOT appear in comments-section (pending status)
- AFTER: comment-textarea is cleared

### Create Post (T_create_post)
- AFTER: API response status 200/201
- AFTER: new post-row appears in list with "Draft" status

### Delete Post/Project/Comment (T_delete)
- AFTER: item row removed from list
- AFTER: list count decreases by 1

### Approve Comment (T_approve)
- AFTER: comment-status-{id} = "Approved"

### Reject Comment (T_reject)
- AFTER: comment-status-{id} = "Rejected"

### Login (T_login)
- AFTER: user-avatar visible, login-btn hidden
- AFTER: cookies set (access_token, csrf_token)

### Logout (T_logout)
- AFTER: login-btn visible, user-avatar hidden
- AFTER: redirected to /
- AFTER: /admin routes inaccessible

### Navigation (T_nav)
- AFTER: URL matches target path
- AFTER: target page container testid visible

## Mutation Assertion Pattern

For any mutation (create, update, delete), use the **before/after pattern**:

1. Capture state BEFORE action (count, text, visibility)
2. Perform action
3. Assert state AFTER action changed as expected
4. Optionally: verify via API response

```typescript
// Example: Delete assertion
const countBefore = await page.locator('[data-testid^="post-row"]').count();
await page.getByTestId(`delete-post-btn-${id}`).click();
// confirm dialog...
const countAfter = await page.locator('[data-testid^="post-row"]').count();
expect(countAfter).toBe(countBefore - 1);
```

## Known System Behaviors

1. **Comments require approval**: New comments are `pending`, only `approved` shown publicly
2. **Like is increment-only**: No toggle/unlike, each click = +1
3. **CSRF required**: All mutation endpoints require X-CSRF-Token header
4. **Token refresh**: access_token can be refreshed via refresh_token cookie
