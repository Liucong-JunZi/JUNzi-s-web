# Task: Fix e2e/specs/like-mbt/like-mbt.spec.ts

## File to modify
`e2e/specs/like-mbt/like-mbt.spec.ts`

## Fixes needed

### Fix 1: LK-013 (line ~471) — getByText('Error') strict mode violation
Error: `getByText('Error')` resolves to 2 elements (toast title div + notification span).
Fix: replace with `page.getByRole('status')`.

Change:
```typescript
await expect(page.getByText('Error')).toBeVisible({ timeout: 10_000 });
```
To:
```typescript
await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 });
```

### Fix 2: LK-015 (line ~539, ~547) — captureLikeState called with Locator but now takes Page
NOTE: The helpers.ts agent is fixing captureLikeState to accept a Locator.
So in this file, the calls `captureLikeState(likeBtn)` are ALREADY CORRECT — no change needed here.
But there's also `assertStateInvariant(beforeState, afterState)` at line ~547 which passes 2 state objects — check the signature of assertStateInvariant in helpers.ts.

Actually the timeout error in LK-015 is because `captureLikeState` takes `Page` but gets a `Locator`. After helpers.ts is fixed this will work. But verify the call sites in this file pass the likeBtn Locator (not page).

Look at line ~539: `const beforeState = await captureLikeState(likeBtn);` — this is correct (passes Locator).
Look at line ~547: `const afterState = await captureLikeState(likeBtnAfter);` — also correct.

So LK-015 needs NO change here, it will be fixed by helpers.ts change.

### Fix 3: LK-007 (line ~229) — heart SVG toHaveClass(/fill-red-500/) flaky
The pre-like is done via `postsApi.like(post.id)` (admin API), but the page is opened as 'user'.
The user has not liked — so liked state won't show. The API client likes as 'user' role by default.

Check line ~214: `await postsApi.like(post.id);` — this calls `like(postId, role='user')` which uses the API client's own user session, NOT the browser 'user' session.
So from the browser's perspective, the like was done by a DIFFERENT user session → button shows 'Like (1)' not 'Liked (1)'.

Fix: Remove the pre-like via API. Instead:
1. Open the page as 'user'
2. Like via UI click first
3. Then unlike via UI click (the test is "Unlike then like (reverse toggle)")

Rewrite LK-007 to:
- Navigate to post
- Click like (transitions to liked)
- Assert liked state
- Click again to unlike
- Assert unliked state
- Click again to like
- Assert liked state

Remove the `await postsApi.like(post.id)` pre-like and the duplicate `createdPostIds.push(post.id)` at line ~215.

### Fix 4: LK-008, LK-009, LK-010, LK-011 — same pre-like problem
All tests that use `await postsApi.like(post.id)` to pre-like have the same issue: the API client uses its own session, so the browser 'user' won't see the liked state.

For each of these tests, replace the `postsApi.like(post.id)` pre-like approach:
- If the test needs to START in liked state: click like via UI at the start
- Remove the `postsApi.like` call and duplicate `createdPostIds.push`

Check which tests do this (grep for `postsApi.like` before the browser context is created).

### Fix 5: LK-024 (line ~831) — user-avatar not found
Line 831: `await page.getByTestId('user-avatar').click();`
This may fail if the element is named differently. Check if it should be `user-menu` or similar.
But first try as-is. If this is the cause of failure, the fix is to use a more robust selector.

## Rules
- Read the file first before editing
- Only modify `e2e/specs/like-mbt/like-mbt.spec.ts`
- Do NOT run tests
- Use Edit tool for changes
- Read each section carefully before editing
