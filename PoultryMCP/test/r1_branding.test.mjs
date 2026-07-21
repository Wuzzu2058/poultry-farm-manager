import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('🧪 Running R1 Branding Test Suite...');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// 1. Inspect web/index.html
const indexPath = path.join(PROJECT_ROOT, 'web', 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

console.log('\n--- Inspecting web/index.html ---');

// Title test
assert(
  indexContent.includes('<title>Poultry Farm Manager - BXN Farm Advisor</title>'),
  'Page title is updated to "Poultry Farm Manager - BXN Farm Advisor"'
);
assert(
  !/AI Enhanced/i.test(indexContent),
  'Page title does not contain "AI Enhanced"'
);

// UI Button labels and headings
assert(
  indexContent.includes('Ask BXN Farm Advisor'),
  'Dashboard button uses "Ask BXN Farm Advisor"'
);
assert(
  !/Ask Llama Advisor/i.test(indexContent),
  'Dashboard button does not contain "Ask Llama Advisor"'
);

assert(
  indexContent.includes('BXN Farm Advisor Insight'),
  'Insight box header uses "BXN Farm Advisor Insight"'
);
assert(
  !/Llama 3\.1 Nemotron Insight/i.test(indexContent),
  'Insight box header does not contain "Llama 3.1 Nemotron Insight"'
);

assert(
  indexContent.includes('✨ BXN Symptom Check'),
  'Symptom check button uses "✨ BXN Symptom Check"'
);
assert(
  !/✨ AI Symptom Check/i.test(indexContent),
  'Symptom check button does not contain "✨ AI Symptom Check"'
);

// User feedback strings in JS
assert(
  indexContent.includes('✨ Querying BXN Farm Advisor...'),
  'Feedback message uses "✨ Querying BXN Farm Advisor..."'
);
assert(
  indexContent.includes('Unable to reach BXN Farm Advisor.'),
  'Error message uses "Unable to reach BXN Farm Advisor."'
);
assert(
  indexContent.includes('✨ BXN Farm Advisor checking symptoms...'),
  'Symptom feedback uses "✨ BXN Farm Advisor checking symptoms..."'
);
assert(
  indexContent.includes('BXN Symptom check unavailable.'),
  'Symptom error uses "BXN Symptom check unavailable."'
);

// Absolute forbidden checks for user-visible strings
const forbiddenLlamaMatches = indexContent.match(/\bllama\b/gi);
assert(
  !forbiddenLlamaMatches,
  `No references to "Llama" found in web/index.html (found: ${forbiddenLlamaMatches?.length || 0})`
);

const genericAiForbiddenPatterns = [
  /AI Enhanced/i,
  /Ask Llama/i,
  /AI Advisor/i,
  /AI Symptom Check/i,
  /AI checking symptoms/i,
  /Querying Llama/i
];

genericAiForbiddenPatterns.forEach(pattern => {
  assert(
    !pattern.test(indexContent),
    `Forbidden string pattern ${pattern} not found in web/index.html`
  );
});

// 2. Inspect web_server.js
console.log('\n--- Inspecting web_server.js ---');
const serverPath = path.join(PROJECT_ROOT, 'web_server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

assert(
  serverContent.includes('No response from BXN Farm Advisor.'),
  'web_server.js fallback response uses "No response from BXN Farm Advisor."'
);
assert(
  !serverContent.includes('No response from AI.'),
  'web_server.js fallback response does not contain "No response from AI."'
);

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 R1 Branding Test Suite PASSED 100%!');
  process.exit(0);
}
