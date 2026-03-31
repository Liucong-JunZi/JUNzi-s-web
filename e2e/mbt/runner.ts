/**
 * MBT Test Runner — Model-Driven Executor
 *
 * Takes generated TestCases and executes them via adapters + observers,
 * replacing the empty-shell approach with real Playwright test execution.
 *
 * Architecture:
 *   TestCase -> registerMBTTests (Playwright test blocks)
 *            -> executeTestCase  (programmatic runner)
 *   Each transition is routed through an adapter; after every step the
 *   observer verifies the actual application state matches the model.
 */

import { test, expect, type Browser } from '@playwright/test';
import { type AppState, ActorStates } from './models/stateMachine';
import { type TransitionType, Transitions } from './models/transitions';
import { type TestCase, type TestSuite } from './generators/testGenerator';
import { type AdapterContext, transitionAdapters } from './adapter';
import {
  observeAppState,
  compareStates,
  assertState,
  type ObservationResult,
} from './observer';
import { openPageAsActor, type ActorRole } from '../specs/tpc/helpers';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface StepResult {
  transition: TransitionType;
  executed: boolean;
  stateBefore: AppState;
  stateAfter: AppState;
  observationAfter: ObservationResult;
  error?: string;
}

export interface TestCaseResult {
  passed: boolean;
  stepResults: StepResult[];
  error?: string;
}

export interface SuiteResult {
  total: number;
  passed: number;
  failed: number;
  results: { testCase: TestCase; result: TestCaseResult }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map an AppState actor value to an ActorRole for openPageAsActor. */
function actorToRole(actor: string): ActorRole {
  if (actor === ActorStates.USER) return 'user';
  if (actor === ActorStates.ADMIN) return 'admin';
  return 'anonymous';
}

// ---------------------------------------------------------------------------
// Core execution functions
// ---------------------------------------------------------------------------

/**
 * Execute a single transition via its adapter and return the new model state.
 *
 * The adapter returns a partial state delta that is deep-merged into the
 * current state so that entity sub-properties are preserved across steps
 * (e.g. setting `entity.like` should not clear `entity.post`).
 */
export async function executeTransition(
  ctx: AdapterContext,
  transition: TransitionType,
  params: Record<string, unknown>,
  fromState: AppState,
): Promise<AppState> {
  const adapter = transitionAdapters[transition];
  const stateDelta = await adapter(ctx, fromState);

  return {
    ...fromState,
    ...stateDelta,
    entity: {
      ...fromState.entity,
      ...(stateDelta.entity ?? {}),
    },
  };
}

/**
 * Execute all transitions in a TestCase sequentially.
 *
 * For each step:
 *  1. Check preconditions from the transition definition
 *  2. Execute the transition via its adapter
 *  3. Observe the real application state
 *  4. Record a StepResult
 *
 * If a step fails, subsequent steps are recorded as skipped.
 */
export async function executeTestCase(
  browser: Browser,
  baseURL: string,
  testCase: TestCase,
): Promise<TestCaseResult> {
  const role = actorToRole(testCase.actor);
  const { context, page } = await openPageAsActor(browser, baseURL, role);

  const adapterCtx: AdapterContext = {
    page,
    context,
    baseURL,
    data: {},
  };

  const stepResults: StepResult[] = [];

  try {
    // Navigate to the initial page
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();

    let currentState: AppState = { ...testCase.initialState };
    let failed = false;

    for (const step of testCase.transitions) {
      const transitionDef = Transitions[step.type];

      // Skip remaining steps after a failure
      if (failed) {
        stepResults.push({
          transition: step.type,
          executed: false,
          stateBefore: { ...currentState },
          stateAfter: { ...currentState },
          observationAfter: {} as ObservationResult,
          error: 'Skipped due to previous step failure',
        });
        continue;
      }

      const stateBefore = { ...currentState };

      try {
        // Check preconditions
        if (transitionDef.preconditions && !transitionDef.preconditions(currentState)) {
          throw new Error(
            `Precondition failed for "${step.type}" in state: ${JSON.stringify(currentState)}`,
          );
        }

        // Execute transition via adapter
        currentState = await executeTransition(
          adapterCtx,
          step.type,
          step.params ?? {},
          currentState,
        );

        // Observe actual application state
        const observed = await observeAppState(page, context, baseURL);
        const observation = compareStates(currentState, observed);

        stepResults.push({
          transition: step.type,
          executed: true,
          stateBefore,
          stateAfter: { ...currentState },
          observationAfter: observation,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        stepResults.push({
          transition: step.type,
          executed: false,
          stateBefore,
          stateAfter: { ...currentState },
          observationAfter: {} as ObservationResult,
          error: message,
        });
        failed = true;
      }
    }

    const hasFailure = stepResults.some((s) => !s.executed);
    return { passed: !hasFailure, stepResults };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { passed: false, stepResults, error: message };
  } finally {
    await context.close();
  }
}

/**
 * Run every TestCase in a TestSuite and aggregate the results.
 *
 * Each test case gets its own BrowserContext (fresh session) so tests
 * remain independent.
 */
export async function executeTestSuite(
  browser: Browser,
  baseURL: string,
  suite: TestSuite,
): Promise<SuiteResult> {
  const results: { testCase: TestCase; result: TestCaseResult }[] = [];

  for (const tc of suite.testCases) {
    const result = await executeTestCase(browser, baseURL, tc);
    results.push({ testCase: tc, result });
  }

  const passed = results.filter((r) => r.result.passed).length;
  const failed = results.filter((r) => !r.result.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}

// ---------------------------------------------------------------------------
// Playwright test registration
// ---------------------------------------------------------------------------

/**
 * Register all test cases in a suite as real Playwright `test()` blocks.
 *
 * This is the primary entry-point for spec files: generate a suite with
 * `generateTestSuite()`, then call `registerMBTTests(suite, role)` at the
 * top level of a spec file.  Each test case runs in its own BrowserContext
 * (fresh session) to guarantee independence.
 *
 * Usage in a spec file:
 * ```ts
 * import { registerMBTTests } from '../../mbt/runner';
 * import { generateTestSuite } from '../../mbt/generators/testGenerator';
 * import { ActorStates } from '../../mbt/models/stateMachine';
 *
 * const suite = generateTestSuite(ActorStates.ANONYMOUS, 'Anonymous User Tests');
 * registerMBTTests(suite, 'anonymous');
 * ```
 */
export function registerMBTTests(suite: TestSuite, role: ActorRole): void {
  test.describe(`MBT: ${suite.name}`, () => {
    for (const tc of suite.testCases) {
      test(`${tc.id}: ${tc.name}`, async ({ browser }) => {
        const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost';
        const { context, page } = await openPageAsActor(browser, baseURL, role);

        try {
          const adapterCtx: AdapterContext = {
            page,
            context,
            baseURL,
            data: {},
          };

          // Setup: navigate to the initial page and wait for the shell
          await page.goto('/');
          await expect(page.locator('header')).toBeVisible();

          let currentState: AppState = { ...tc.initialState };

          // Execute each transition in order
          for (const step of tc.transitions) {
            const transitionDef = Transitions[step.type];

            // Verify preconditions from the model — skip if invalid
            if (transitionDef.preconditions && !transitionDef.preconditions(currentState)) {
              test.skip(
                true,
                `Precondition not met for "${step.type}" in state ${currentState.actor}@${currentState.page}`,
              );
            }

            // Execute the transition via the adapter
            currentState = await executeTransition(
              adapterCtx,
              step.type,
              step.params ?? {},
              currentState,
            );

            // Observe and verify the actual application state
            await assertState(currentState, page, context, baseURL);
          }
        } finally {
          await context.close();
        }
      });
    }
  });
}
