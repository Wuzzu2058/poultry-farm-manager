import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('🧪 Running R4 Interactive Medication & Dosage Guide Test Suite...');

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

console.log('\n--- 1. Testing Medication & Vaccine Presets Guide HTML Section ---');

// Mandatory presets check
const mandatoryPresets = [
  'Newcastle Disease (HB1 / LaSota)',
  'Gumboro (IBDV)',
  'Fowl Pox',
  'Coccidiostat (Amprolium / Anticoccidial)'
];

mandatoryPresets.forEach((preset) => {
  assert(
    indexContent.includes(preset),
    `Preset card header/name "${preset}" exists in web/index.html`
  );
});

// Additional standard presets check
const additionalPresets = [
  "Marek's Disease",
  'Infectious Bronchitis',
  'Dewormer'
];

additionalPresets.forEach((preset) => {
  assert(
    indexContent.includes(preset),
    `Additional standard preset "${preset}" exists in web/index.html`
  );
});

console.log('\n--- 2. Testing Dilution Rates, Dosages, Application Method & Timing Instructions ---');

// Newcastle Disease instructions check
assert(
  indexContent.includes('1000 doses in 10-20L cool non-chlorinated water'),
  'Newcastle Disease dilution rate (1000 doses in 10-20L cool non-chlorinated water) present'
);
assert(
  indexContent.includes('1 dose/bird') && indexContent.includes('In drinking water'),
  'Newcastle Disease dosage rate (1 dose/bird) and application method (In drinking water) present'
);
assert(
  indexContent.includes('Day 7 & 21'),
  'Newcastle Disease timing instructions (Day 7 & 21) present'
);

// Gumboro instructions check
assert(
  indexContent.includes('1000 doses in 10-20L cool water with skimmed milk powder stabilizer'),
  'Gumboro dilution rate (1000 doses in 10-20L cool water with skimmed milk powder stabilizer) present'
);
assert(
  indexContent.includes('Day 10 & 18'),
  'Gumboro timing instructions (Day 10 & 18) present'
);

// Fowl Pox instructions check
assert(
  indexContent.includes('Reconstitute freeze-dried vaccine with diluent provided') ||
  indexContent.includes('reconstitute freeze-dried vaccine with diluent provided'),
  'Fowl Pox dilution rate (Reconstitute freeze-dried vaccine with diluent provided) present'
);
assert(
  indexContent.includes('Wing-web prick'),
  'Fowl Pox application method (Wing-web prick) present'
);
assert(
  indexContent.includes('Week 6'),
  'Fowl Pox timing instructions (Week 6) present'
);

// Coccidiostat instructions check
assert(
  indexContent.includes('0.5g/L in drinking water for 5-7 consecutive days'),
  'Coccidiostat dilution & duration (0.5g/L in drinking water for 5-7 consecutive days) present'
);
assert(
  indexContent.includes('0.5g/L'),
  'Coccidiostat dosage rate (0.5g/L) present'
);

console.log('\n--- 3. Testing Single-Click "Add Preset to Schedule" Buttons & Data Structure ---');

// Check presence of single-click buttons in HTML
const addPresetButtonClickCount = (indexContent.match(/onclick="addPresetToSchedule\(/g) || []).length;
assert(
  addPresetButtonClickCount >= 4,
  `Found ${addPresetButtonClickCount} "Add Preset to Schedule" interactive buttons in HTML`
);

// Verify MEDICATION_PRESETS structure in JS code
assert(
  indexContent.includes('const MEDICATION_PRESETS =') || indexContent.includes('MEDICATION_PRESETS ='),
  'MEDICATION_PRESETS data structure is defined in web/index.html'
);

assert(
  indexContent.includes('addPresetToSchedule'),
  'addPresetToSchedule handler function is defined in web/index.html'
);

// Extract MEDICATION_PRESETS and addPresetToSchedule for dynamic logic evaluation
const presetsMatch = indexContent.match(/const MEDICATION_PRESETS = (\[[\s\S]*?\n\s*\]);/);
assert(presetsMatch !== null, 'Successfully extracted MEDICATION_PRESETS array from HTML');

let presetsArray = [];
if (presetsMatch) {
  try {
    presetsArray = new Function(`return ${presetsMatch[1]}`)();
  } catch (e) {
    console.error('Failed to parse MEDICATION_PRESETS array:', e.message);
  }
}

assert(presetsArray.length >= 4, `MEDICATION_PRESETS contains ${presetsArray.length} items`);

console.log('\n--- 4. Single-Click Preset Addition Logic Execution Verification ---');

// Extract and prepare addPresetToSchedule function for testing in Node environment
const handlerMatch = indexContent.match(/window\.addPresetToSchedule = function([\s\S]*?\n\s*\};)/);
assert(handlerMatch !== null, 'Successfully extracted addPresetToSchedule function code');

let testAddPresetToSchedule = null;
if (handlerMatch) {
  try {
    const fnBody = handlerMatch[1];
    testAddPresetToSchedule = new Function(
      'MEDICATION_PRESETS',
      'getActiveBatch',
      'saveState',
      'document',
      `
      let window = { MEDICATION_PRESETS };
      let addPresetToSchedule = function${fnBody};
      return addPresetToSchedule;
      `
    )(presetsArray, () => null, () => {}, null);
  } catch (e) {
    console.error('Failed to construct testAddPresetToSchedule:', e.message);
  }
}

assert(typeof testAddPresetToSchedule === 'function', 'testAddPresetToSchedule function constructed successfully');

// Run tests on mock batch schedule
const mockBatch = {
  id: 'batch-test-101',
  name: 'Test Farm Batch',
  startDate: '2026-07-01',
  schedule: []
};

if (typeof testAddPresetToSchedule === 'function') {
  // Test 1: Newcastle Preset Addition
  const newcastleEntries = testAddPresetToSchedule('newcastle', mockBatch);
  assert(
    Array.isArray(newcastleEntries) && newcastleEntries.length === 2,
    'Adding Newcastle Disease preset generates 2 schedule entries (Day 7 & 21)'
  );
  assert(
    mockBatch.schedule.some((s) => s.name.includes('Newcastle') && s.date === '2026-07-08'),
    'Newcastle Dose 1 correctly scheduled for Day 7 (2026-07-08)'
  );
  assert(
    mockBatch.schedule.some((s) => s.name.includes('Newcastle') && s.date === '2026-07-22'),
    'Newcastle Dose 2 correctly scheduled for Day 21 (2026-07-22)'
  );

  // Test 2: Gumboro Preset Addition
  const gumboroEntries = testAddPresetToSchedule('gumboro', mockBatch);
  assert(
    Array.isArray(gumboroEntries) && gumboroEntries.length === 2,
    'Adding Gumboro preset generates 2 schedule entries (Day 10 & 18)'
  );
  assert(
    mockBatch.schedule.some((s) => s.name.includes('Gumboro') && s.date === '2026-07-11'),
    'Gumboro Dose 1 correctly scheduled for Day 10 (2026-07-11)'
  );

  // Test 3: Fowl Pox Preset Addition
  const fowlPoxEntries = testAddPresetToSchedule('fowl-pox', mockBatch);
  assert(
    Array.isArray(fowlPoxEntries) && fowlPoxEntries.length === 1,
    'Adding Fowl Pox preset generates 1 schedule entry (Week 6 / Day 42)'
  );
  assert(
    mockBatch.schedule.some((s) => s.name.includes('Fowl Pox') && s.date === '2026-08-12'),
    'Fowl Pox correctly scheduled for Day 42 (2026-08-12)'
  );

  // Test 4: Coccidiostat Preset Addition
  const coccidiostatEntries = testAddPresetToSchedule('coccidiostat', mockBatch);
  assert(
    Array.isArray(coccidiostatEntries) && coccidiostatEntries.length === 1,
    'Adding Coccidiostat preset generates 1 schedule entry'
  );
  assert(
    mockBatch.schedule.some((s) => s.name.includes('Coccidiostat') && s.desc.includes('0.5g/L')),
    'Coccidiostat schedule entry contains dosage instruction (0.5g/L)'
  );
}

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 R4 Interactive Medication & Dosage Guide Test Suite PASSED 100%!');
  process.exit(0);
}
