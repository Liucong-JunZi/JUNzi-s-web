import { Transition, TransitionList } from '../models/transitions';
import { ActorStates } from '../models/stateMachine';

export interface TransitionPair {
  id: string;
  t1: Transition;
  t2: Transition;
  valid: boolean;
  reason?: string;
}

export interface TPCReport {
  totalPairs: number;
  validPairs: number;
  invalidPairs: number;
  pairsByActor: Map<string, TransitionPair[]>;
  pairsByTransition: Map<string, TransitionPair[]>;
}

export function generateTPCPairs(): TransitionPair[] {
  const pairs: TransitionPair[] = [];
  
  for (const t1 of TransitionList) {
    for (const t2 of TransitionList) {
      const pair = createTransitionPair(t1, t2);
      pairs.push(pair);
    }
  }
  
  return pairs;
}

function createTransitionPair(t1: Transition, t2: Transition): TransitionPair {
  const validActors = t1.allowedActors.filter(actor => 
    t2.allowedActors.includes(actor)
  );
  
  const valid = validActors.length > 0;
  
  return {
    id: `${t1.id}_${t2.id}`,
    t1,
    t2,
    valid,
    reason: valid 
      ? `Both transitions allowed for: ${validActors.join(', ')}`
      : 'No common actor can perform both transitions',
  };
}

export function getPairsByActor(actor: typeof ActorStates[keyof typeof ActorStates]): TransitionPair[] {
  const allPairs = generateTPCPairs();
  return allPairs.filter(p => 
    p.valid && p.t1.allowedActors.includes(actor) && p.t2.allowedActors.includes(actor)
  );
}

export function generateTPCReport(): TPCReport {
  const pairs = generateTPCPairs();
  const validPairs = pairs.filter(p => p.valid);
  const invalidPairs = pairs.filter(p => !p.valid);
  
  const pairsByActor = new Map<string, TransitionPair[]>();
  const pairsByTransition = new Map<string, TransitionPair[]>();
  
  for (const actor of Object.values(ActorStates)) {
    pairsByActor.set(actor, validPairs.filter(
      p => p.t1.allowedActors.includes(actor) && p.t2.allowedActors.includes(actor)
    ));
  }
  
  for (const t of TransitionList) {
    pairsByTransition.set(t.id, validPairs.filter(
      p => p.t1.id === t.id || p.t2.id === t.id
    ));
  }
  
  return {
    totalPairs: pairs.length,
    validPairs: validPairs.length,
    invalidPairs: invalidPairs.length,
    pairsByActor,
    pairsByTransition,
  };
}

export function exportPairsAsJSON(): string {
  const pairs = generateTPCPairs();
  return JSON.stringify(pairs, null, 2);
}
