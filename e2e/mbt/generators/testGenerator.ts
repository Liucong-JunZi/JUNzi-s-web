import { TransitionPair, getPairsByActor } from './tpcGenerator';
import { ActorStates, PageStates, AppState } from '../models/stateMachine';
import { TransitionType } from '../models/transitions';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  actor: typeof ActorStates[keyof typeof ActorStates];
  initialState: AppState;
  transitions: {
    type: TransitionType;
    params?: Record<string, unknown>;
  }[];
  assertions: {
    type: 'state_invariant' | 'transition_postcondition' | 'api_response' | 'ui_element';
    target: string;
    expected: unknown;
  }[];
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}

export interface TestSuite {
  name: string;
  description: string;
  testCases: TestCase[];
  coverage: {
    transitions: number;
    transitionPairs: number;
    states: number;
  };
}

export function generateTestCasesFromPairs(pairs: TransitionPair[]): TestCase[] {
  const testCases: TestCase[] = [];
  
  for (const pair of pairs) {
    if (!pair.valid) continue;
    
    const testCase = createTestCase(pair);
    testCases.push(testCase);
  }
  
  return testCases;
}

function createTestCase(pair: TransitionPair): TestCase {
  const actor = pair.t1.allowedActors[0];
  const priority = calculatePriority(pair);
  
  return {
    id: `TC_${pair.id}`,
    name: `${pair.t1.name} → ${pair.t2.name}`,
    description: `Test ${pair.t1.description} followed by ${pair.t2.description}`,
    actor,
    initialState: {
      actor,
      page: PageStates.HOME,
      isAuthenticated: actor !== ActorStates.ANONYMOUS,
    },
    transitions: [
      { type: pair.t1.type },
      { type: pair.t2.type },
    ],
    assertions: generateAssertions(pair),
    priority,
    tags: generateTags(pair),
  };
}

function generateAssertions(pair: TransitionPair): TestCase['assertions'] {
  const assertions: TestCase['assertions'] = [];
  
  assertions.push({
    type: 'state_invariant',
    target: 'header',
    expected: pair.t1.allowedActors[0],
  });
  
  if (pair.t1.type === 'like' || pair.t2.type === 'like') {
    assertions.push({
      type: 'ui_element',
      target: '[data-testid="like-btn"]',
      expected: 'visible',
    });
  }
  
  if (pair.t1.type === 'submit_comment' || pair.t2.type === 'submit_comment') {
    assertions.push({
      type: 'ui_element',
      target: '[data-testid="comments-section"]',
      expected: 'visible',
    });
  }
  
  return assertions;
}

function calculatePriority(pair: TransitionPair): 'high' | 'medium' | 'low' {
  const highPriorityTypes = [
    'login',
    'logout',
    'like',
    'unlike',
    'create_post',
    'delete_post',
  ];
  const mediumPriorityTypes = [
    'submit_comment',
    'approve_comment',
    'reject_comment',
  ];
  
  const t1High = highPriorityTypes.includes(pair.t1.type);
  const t2High = highPriorityTypes.includes(pair.t2.type);
  const t1Medium = mediumPriorityTypes.includes(pair.t1.type);
  const t2Medium = mediumPriorityTypes.includes(pair.t2.type);
  
  if (t1High || t2High) return 'high';
  if (t1Medium || t2Medium) return 'medium';
  return 'low';
}

function generateTags(pair: TransitionPair): string[] {
  const tags: string[] = [pair.t1.type, pair.t2.type];
  
  if (pair.t1.allowedActors.includes(ActorStates.ANONYMOUS)) {
    tags.push('anonymous');
  }
  if (pair.t1.allowedActors.includes(ActorStates.USER)) {
    tags.push('user');
  }
  if (pair.t1.allowedActors.includes(ActorStates.ADMIN)) {
    tags.push('admin');
  }
  
  return tags;
}

export function generateTestSuite(
  actor: typeof ActorStates[keyof typeof ActorStates],
  name: string
): TestSuite {
  const pairs = getPairsByActor(actor);
  const testCases = generateTestCasesFromPairs(pairs);
  
  const highPriority = testCases.filter(t => t.priority === 'high');
  const mediumPriority = testCases.filter(t => t.priority === 'medium');
  const lowPriority = testCases.filter(t => t.priority === 'low');
  
  return {
    name,
    description: `TPC test suite for ${actor}`,
    testCases: [...highPriority, ...mediumPriority, ...lowPriority],
    coverage: {
      transitions: new Set(testCases.flatMap(t => t.transitions.map(tr => tr.type))).size,
      transitionPairs: testCases.length,
      states: 0,
    },
  };
}

export function exportAsPlaywrightTests(testCases: TestCase[]): string {
  let output = `// Auto-generated TPC test cases\n`;
  output += `// Generated: ${new Date().toISOString()}\n\n`;
  output += `import { test, expect } from '@playwright/test';\n`;
  output += `import { openPageAsActor, type ActorRole } from '../tpc/helpers';\n\n`;
  output += `function toActorRole(actor: string): ActorRole {\n`;
  output += `  if (actor === 'S_USER') return 'user';\n`;
  output += `  if (actor === 'S_ADMIN') return 'admin';\n`;
  output += `  return 'anonymous';\n`;
  output += `}\n\n`;
  
  for (const tc of testCases) {
    output += generateTestFunction(tc);
    output += '\n\n';
  }
  
  return output;
}

function generateTestFunction(tc: TestCase): string {
  return `
test('${tc.id}: ${tc.name}', async ({ browser }) => {
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost';
  const { context, page } = await openPageAsActor(browser, baseURL, toActorRole('${tc.actor}'));

  try {
    // Setup: Navigate to initial page
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();

    // TODO: Add transition steps based on tc.transitions
    // TODO: Add assertions based on tc.assertions

  } finally {
    await context.close();
  }
});
`.trim();
}

/**
 * Generate a complete Playwright spec file that uses the MBT runner
 * (adapter + observer) instead of empty TODO stubs.
 *
 * @param suite - The TestSuite to render as a spec
 * @param role  - ActorRole string: 'anonymous' | 'user' | 'admin'
 * @returns A self-contained spec file as a string
 */
export function generatePlaywrightSpec(suite: TestSuite, role: string): string {
  // Derive the ActorStates key from the role (e.g. 'user' -> 'USER')
  const actorKey = role.toUpperCase();

  return `// Auto-generated MBT spec — model-driven with adapter + oracle
import { test, expect } from '@playwright/test';
import { registerMBTTests } from '../../mbt/runner';
import { generateTestSuite } from '../../mbt/generators/testGenerator';
import { ActorStates } from '../../mbt/models/stateMachine';

const suite = generateTestSuite(ActorStates.${actorKey}, '${suite.name}');
registerMBTTests(suite, '${role}');
`;
}
