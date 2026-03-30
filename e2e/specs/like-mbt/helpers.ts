import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Extract the like count from the like button text.
 * Button text format: "Like (5)" or "Liked (6)"
 */
export async function extractLikeCount(likeBtn: Locator): Promise<number> {
  const text = await likeBtn.textContent();
  if (!text) throw new Error('like-btn has no text content');
  const match = text.match(/\d+/);
  if (!match) throw new Error(`Could not parse count from like-btn text: "${text}"`);
  return parseInt(match[0], 10);
}

/**
 * Assert the like button is in the LIKED state.
 * - Button text contains "Liked"
 * - Count matches expectedCount
 * - Heart SVG has fill-red-500 class
 */
export async function assertLikedState(likeBtn: Locator, expectedCount: number): Promise<void> {
  await expect(likeBtn).toContainText('Liked');   // retry-capable
  const text = await likeBtn.textContent();
  const count = parseInt(text!.match(/\d+/)![0], 10);
  expect(count).toBe(expectedCount);
  // Heart icon (SVG inside button) should have fill
  const heart = likeBtn.locator('svg');
  await expect(heart).toHaveClass(/fill-red-500/);
}

/**
 * Assert the like button is in the UNLIKED state.
 * - Button text contains "Like" but NOT "Liked"
 * - Count matches expectedCount
 * - Heart SVG does NOT have fill-red-500 class
 */
export async function assertUnlikedState(likeBtn: Locator, expectedCount: number): Promise<void> {
  await expect(likeBtn).not.toContainText('Liked');  // retry-capable
  await expect(likeBtn).toContainText('Like');
  const text = await likeBtn.textContent();
  const count = parseInt(text!.match(/\d+/)![0], 10);
  expect(count).toBe(expectedCount);
  // Heart icon should NOT have fill
  const heart = likeBtn.locator('svg');
  await expect(heart).not.toHaveClass(/fill-red-500/);
}

/**
 * Capture the full like state as a snapshot.
 */
export async function captureLikeState(likeBtn: Locator): Promise<{
  liked: boolean;
  count: number;
  btnText: string;
}> {
  const btnText = (await likeBtn.textContent()) ?? '';
  const count = parseInt(btnText.match(/\d+/)![0], 10);
  const liked = btnText.startsWith('Liked');
  return { liked, count, btnText };
}

/**
 * Assert all invariants for a given FSM state.
 *
 * States:
 *   S0: anon, post_detail, unliked → login-btn visible, user-avatar NOT visible, like-btn shows "Like (N)"
 *   S2: user, post_detail, unliked → user-avatar visible, login-btn NOT visible, like-btn shows "Like (N)"
 *   S3: user, post_detail, liked  → user-avatar visible, like-btn shows "Liked (N)", heart fill-red-500
 *   S5: admin, post_detail, unliked → same as S2
 *   S6: admin, post_detail, liked → same as S3
 */
export async function assertStateInvariant(
  page: Page,
  stateId: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7'
): Promise<void> {
  const likeBtn = page.getByTestId('like-btn');
  const userAvatar = page.getByTestId('user-avatar');
  const loginBtn = page.getByTestId('login-btn');

  switch (stateId) {
    case 'S0': // anon, post_detail, unliked
      await expect(likeBtn).toBeVisible();
      await expect(likeBtn).toContainText('Like');
      await expect(likeBtn).not.toContainText('Liked');
      await expect(loginBtn).toBeVisible();
      await expect(userAvatar).not.toBeVisible();
      {
        const heart = likeBtn.locator('svg');
        await expect(heart).not.toHaveClass(/fill-red-500/);
      }
      break;

    case 'S1': // anon, blog_list
      await expect(page.getByTestId('blog-page')).toBeVisible();
      await expect(loginBtn).toBeVisible();
      await expect(userAvatar).not.toBeVisible();
      break;

    case 'S2': // user, post_detail, unliked
      await expect(likeBtn).toBeVisible();
      await expect(likeBtn).toContainText('Like');
      await expect(likeBtn).not.toContainText('Liked');
      await expect(userAvatar).toBeVisible();
      await expect(loginBtn).not.toBeVisible();
      {
        const heart = likeBtn.locator('svg');
        await expect(heart).not.toHaveClass(/fill-red-500/);
      }
      break;

    case 'S3': // user, post_detail, liked
      await expect(likeBtn).toBeVisible();
      await expect(likeBtn).toContainText('Liked');
      await expect(userAvatar).toBeVisible();
      await expect(loginBtn).not.toBeVisible();
      {
        const heart = likeBtn.locator('svg');
        await expect(heart).toHaveClass(/fill-red-500/);
      }
      break;

    case 'S4': // user, blog_list
      await expect(page.getByTestId('blog-page')).toBeVisible();
      await expect(userAvatar).toBeVisible();
      await expect(loginBtn).not.toBeVisible();
      break;

    case 'S5': // admin, post_detail, unliked (same visual as S2)
      await expect(likeBtn).toBeVisible();
      await expect(likeBtn).toContainText('Like');
      await expect(likeBtn).not.toContainText('Liked');
      await expect(userAvatar).toBeVisible();
      {
        const heart = likeBtn.locator('svg');
        await expect(heart).not.toHaveClass(/fill-red-500/);
      }
      break;

    case 'S6': // admin, post_detail, liked (same visual as S3)
      await expect(likeBtn).toBeVisible();
      await expect(likeBtn).toContainText('Liked');
      await expect(userAvatar).toBeVisible();
      {
        const heart = likeBtn.locator('svg');
        await expect(heart).toHaveClass(/fill-red-500/);
      }
      break;

    case 'S7': // admin, blog_list (same visual as S4)
      await expect(page.getByTestId('blog-page')).toBeVisible();
      await expect(userAvatar).toBeVisible();
      break;
  }
}
