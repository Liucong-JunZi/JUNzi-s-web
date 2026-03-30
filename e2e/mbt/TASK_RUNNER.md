# TASK: Build MBT Test Runner (Model-Driven Executor)

## Context
The MBT framework has:
- State machine model: `e2e/mbt/models/stateMachine.ts` + `transitions.ts`
- TPC generator: `e2e/mbt/generators/tpcGenerator.ts` (generates transition pairs)
- Test generator: `e2e/mbt/generators/testGenerator.ts` (generates TestCase JSON)
- Assertions: `e2e/mbt/assertions/`

But the generated tests are **empty shells** — the `testGenerator.ts` exports `generateTestFunction()` that outputs `// TODO: Add transition steps`. We need a real **test runner** that:
1. Takes a generated TestCase (with transitions and expected states)
2. Executes each transition via the adapter
3. After each transition, uses the observer to verify state
4. Reports pass/fail

## What to Create
**File: `/Users/liucong/code/JUNziweb/e2e/mbt/runner.ts`**

### Architecture

```typescript
import { type Page, type BrowserContext, test, expect } from '@playwright/test';
import { type AppState, type StateId, ActorStates, PageStates } from './models/stateMachine';
import { type TransitionType, Transitions, type Transition } from './models/transitions';
import { type TestCase, type TestSuite } from './generators/testGenerator';
import { type AdapterContext, transitionAdapters } from './adapter';
import { observeAppState, compareStates, assertState, type ObservationResult } from './observer';
import { openPageAsActor, type ActorRole } from '../specs/tpc/helpers';
```

### Required Functions

#### 1. `executeTransition(ctx: AdapterContext, transition: TransitionType, params: Record<string, unknown>, fromState: AppState): Promise<AppState>`
Execute one transition:
```typescript
const adapter = transitionAdapters[transition];
const stateDelta = await adapter(ctx, fromState);
// Merge delta into fromState
return { ...fromState, ...stateDelta, entity: { ...fromState.entity, ...stateDelta.entity } };
```

#### 2. `executeTestCase(browser, baseURL, testCase: TestCase): Promise<{ passed: boolean; stepResults: StepResult[] }>`
Execute all transitions in a test case sequentially:
```typescript
interface StepResult {
  transition: TransitionType;
  executed: boolean;
  stateBefore: AppState;
  stateAfter: AppState;
  observationAfter: ObservationResult;
  error?: string;
}
```

For each test case:
1. Setup actor context via `openPageAsActor(browser, baseURL, role)`
2. Navigate to initial state (e.g., `page.goto('/')`)
3. For each transition in `testCase.transitions`:
   a. Call `executeTransition()` with the adapter
   b. Observe actual state via observer
   c. Compare with expected state
   d. Record StepResult
4. Close context
5. Return results

#### 3. `executeTestSuite(browser, baseURL, suite: TestSuite): Promise<SuiteResult>`
Run all test cases in a suite:
```typescript
interface SuiteResult {
  total: number;
  passed: number;
  failed: number;
  results: { testCase: TestCase; result: TestCaseResult }[];
}
```

#### 4. Playwright Test Generator: `registerMBTTests(suite: TestSuite, role: ActorRole)`
This is the key function that replaces the empty `generateTestFunction()`. It creates real Playwright `test()` blocks:

```typescript
export function registerMBTTests(suite: TestSuite, role: ActorRole) {
  for (const tc of suite.testCases) {
    test(`${tc.id}: ${tc.name}`, async ({ browser }) => {
      const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost';
      const { context, page } = await openPageAsActor(browser, baseURL, role);

      try {
        // Initialize adapter context
        const adapterCtx: AdapterContext = {
          page, context, baseURL,
          data: {},
        };

        // Setup initial state
        await page.goto('/');
        await expect(page.locator('header')).toBeVisible();

        let currentState = { ...tc.initialState };

        // Execute each transition
        for (const step of tc.transitions) {
          const transitionDef = Transitions[step.type];

          // Check precondition
          if (transitionDef.preconditions && !transitionDef.preconditions(currentState)) {
            throw new Error(`Precondition failed for ${step.type} in state ${JSON.stringify(currentState)}`);
          }

          // Execute
          currentState = await executeTransition(adapterCtx, step.type, step.params ?? {}, currentState);

          // Observe and verify
          await assertState(currentState, page, context, baseURL);
        }
      } finally {
        await context.close();
      }
    });
  }
}
```

### Regenerate spec files
After building the runner, we need to update the CLI (`e2e/mbt/cli.ts`) and the three spec files (`e2e/specs/mbt/s_anon.spec.ts`, `s_user.spec.ts`, `s_admin.spec.ts`) to use `registerMBTTests` instead of the empty shells.

**New spec file pattern:**
```typescript
// e2e/specs/mbt/s_anon.spec.ts
import { test, expect } from '@playwright/test';
import { registerMBTTests } from '../../mbt/runner';
import { generateTestSuite } from '../../mbt/generators/testGenerator';
import { ActorStates } from '../../mbt/models/stateMachine';

const suite = generateTestSuite(ActorStates.ANONYMOUS, 'Anonymous User Tests');
registerMBTTests(suite, 'anonymous');
```

### Also Update
**File: `/Users/liucong/code/JUNziweb/e2e/mbt/generators/testGenerator.ts`**

Update `generateTestFunction()` to produce real test code using the runner instead of TODO stubs. Or better — keep the JSON generation as-is but add a new export:

```typescript
export function generatePlaywrightSpec(suite: TestSuite, role: string): string {
  return `// Auto-generated MBT spec — model-driven with adapter + oracle
import { test, expect } from '@playwright/test';
import { registerMBTTests } from '../../mbt/runner';
import { generateTestSuite } from '../../mbt/generators/testGenerator';
import { ActorStates } from '../../mbt/models/stateMachine';

const suite = generateTestSuite(ActorStates.${role.toUpperCase()}, '${suite.name}');
registerMBTTests(suite, '${role}');
`;
}
```

### Important Notes
- The runner must handle the case where a transition is not applicable (e.g., anonymous trying to like — the adapter should handle this gracefully by performing the action and letting the observer verify the expected denial)
- Use `test.describe()` to group tests by actor
- Each test case is independent — fresh context per test
- Error messages should be descriptive: include transition name, expected vs actual state
- The `data` field in AdapterContext must be populated by transitions (e.g., `create_post` sets `data.currentPostSlug`)
