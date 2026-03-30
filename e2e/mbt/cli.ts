#!/usr/bin/env node

const { generateTPCReport, exportPairsAsJSON } = require('./generators/tpcGenerator');
const { generateTestSuite, exportAsPlaywrightTests } = require('./generators/testGenerator');
const { ActorStates } = require('./models/stateMachine');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../../specs/mbt');

async function main() {
  console.log('MBT Test Generator\n');
  
  console.log('Generating TPC Report...');
  const report = generateTPCReport();
  console.log(`   Total pairs: ${report.totalPairs}`);
  console.log(`   Valid pairs: ${report.validPairs}`);
  console.log(`   Invalid pairs: ${report.invalidPairs}`);
  
  const pairsJson = exportPairsAsJSON();
  const pairsFile = path.join(OUTPUT_DIR, 'tpc-pairs.json');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(pairsFile, pairsJson);
  console.log(`   Saved to ${pairsFile}`);
  
  console.log('\nGenerating Test Suites...');
  
  const actors = [
    { actor: ActorStates.ANONYMOUS, name: 'Anonymous User Tests' },
    { actor: ActorStates.USER, name: 'Authenticated User Tests' },
    { actor: ActorStates.ADMIN, name: 'Admin User Tests' },
  ];
  
  let totalTests = 0;
  
  for (const { actor, name } of actors) {
    const suite = generateTestSuite(actor, name);
    totalTests += suite.testCases.length;
    
    const suiteFile = path.join(OUTPUT_DIR, `${actor.toLowerCase()}-suite.json`);
    fs.writeFileSync(suiteFile, JSON.stringify(suite, null, 2));
    console.log(`   ${actor}: ${suite.testCases.length} tests`);
    
    const testFile = path.join(OUTPUT_DIR, `${actor.toLowerCase()}.spec.ts`);
    const testCode = exportAsPlaywrightTests(suite.testCases);
    fs.writeFileSync(testFile, testCode);
  }
  
  console.log(`\nGenerated ${totalTests} test cases`);
  console.log(`   Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);
