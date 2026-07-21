import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('🧪 Running R3 Feeds & Nutrient Models Test Suite...');

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

console.log('\n--- 1. Testing Feeding Select Dropdown Options in web/index.html ---');

// Mandatory feeds check
const mandatoryFeeds = ['Chick Mash', 'Grower Mash', 'Layers Mash', 'Broiler Finisher'];
mandatoryFeeds.forEach((feed) => {
  assert(
    indexContent.includes(`value="${feed}"`),
    `Dropdown option for standard Kenyan feed "${feed}" exists in #log-feed-type`
  );
});

// Additional Kenyan feeds check
const additionalFeeds = ['Broiler Starter', 'Kienyeji Mash'];
additionalFeeds.forEach((feed) => {
  assert(
    indexContent.includes(`value="${feed}"`),
    `Dropdown option for standard Kenyan feed "${feed}" exists in #log-feed-type`
  );
});

// Age range label check
assert(
  indexContent.includes('Chick Mash (0-8 weeks)'),
  'Chick Mash option includes age label (0-8 weeks)'
);
assert(
  indexContent.includes('Grower Mash (8-18 weeks)'),
  'Grower Mash option includes age label (8-18 weeks)'
);
assert(
  indexContent.includes('Layers Mash (18+ weeks)'),
  'Layers Mash option includes age label (18+ weeks)'
);
assert(
  indexContent.includes('Broiler Finisher (4-6 weeks)'),
  'Broiler Finisher option includes age label (4-6 weeks)'
);

console.log('\n--- 2. Testing Nutrient Profile Data Structure ---');

// Verify KENYAN_FEEDS data structure in code
assert(
  indexContent.includes('const KENYAN_FEEDS =') || indexContent.includes('KENYAN_FEEDS ='),
  'KENYAN_FEEDS data structure is defined in web/index.html'
);

// Extract KENYAN_FEEDS definition using regex
const feedsMatch = indexContent.match(/const KENYAN_FEEDS = (\{[\s\S]*?\n\s*\});/);
assert(feedsMatch !== null, 'Successfully extracted KENYAN_FEEDS object from HTML');

let kenyanFeedsObj = {};
if (feedsMatch) {
  try {
    // Safely parse object literal using Function evaluation
    kenyanFeedsObj = new Function(`return ${feedsMatch[1]}`)();
  } catch (e) {
    console.error('Failed to parse KENYAN_FEEDS object:', e.message);
  }
}

const expectedFeedKeys = [
  'Chick Mash',
  'Grower Mash',
  'Layers Mash',
  'Broiler Starter',
  'Broiler Finisher',
  'Kienyeji Mash'
];

expectedFeedKeys.forEach((key) => {
  const profile = kenyanFeedsObj[key];
  assert(profile !== undefined, `Nutrient profile exists for "${key}"`);
  if (profile) {
    assert(
      typeof profile.cp === 'number' && profile.cp > 0,
      `"${key}" specifies Crude Protein (CP % = ${profile.cp})`
    );
    assert(
      typeof profile.me === 'number' && profile.me > 0,
      `"${key}" specifies Metabolizable Energy (ME kcal/kg = ${profile.me})`
    );
    assert(
      typeof profile.ca === 'number' && profile.ca > 0,
      `"${key}" specifies Calcium (Ca % = ${profile.ca})`
    );
    assert(
      typeof profile.intakeGramsPerBird === 'number' && profile.intakeGramsPerBird > 0,
      `"${key}" specifies daily intake rate (${profile.intakeGramsPerBird} g/bird/day)`
    );
  }
});

console.log('\n--- 3. Testing Dashboard Formula & Calculation Output ---');

// Formula string rendering check
assert(
  indexContent.includes('Recommended Daily Feed (kg) = Flock Size × Intake Rate (g/bird/day) ÷ 1000'),
  'Mathematical formula rendering present in Home dashboard widget'
);

assert(
  indexContent.includes('Nutrient Profile Breakdown'),
  'Nutrient profile breakdown header rendered on Home dashboard widget'
);

assert(
  indexContent.includes('updateFeedSuggestion'),
  'updateFeedSuggestion function defined in web/index.html'
);

// Test math model output accuracy
console.log('\n--- 4. Mathematical Feed Intake Calculation Verification ---');

function calculateFeedIntake(flockSize, feedName) {
  const feed = kenyanFeedsObj[feedName];
  if (!feed) return null;
  const ratio = feed.intakeGramsPerBird / 1000;
  return parseFloat((flockSize * ratio).toFixed(1));
}

const testCases = [
  { flockSize: 100, feedName: 'Chick Mash', expectedKg: 3.5 },
  { flockSize: 200, feedName: 'Grower Mash', expectedKg: 15.0 },
  { flockSize: 500, feedName: 'Layers Mash', expectedKg: 60.0 },
  { flockSize: 250, feedName: 'Broiler Finisher', expectedKg: 32.5 },
  { flockSize: 150, feedName: 'Kienyeji Mash', expectedKg: 12.8 }
];

testCases.forEach(({ flockSize, feedName, expectedKg }) => {
  const calculated = calculateFeedIntake(flockSize, feedName);
  assert(
    calculated === expectedKg,
    `Feed intake for ${flockSize} birds on ${feedName} = ${calculated} kg (expected: ${expectedKg} kg)`
  );
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 R3 Feeds & Nutrient Models Test Suite PASSED 100%!');
  process.exit(0);
}
