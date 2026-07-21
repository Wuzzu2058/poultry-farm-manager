import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tests = [
  path.join(__dirname, 'r1_branding.test.mjs'),
  path.join(__dirname, 'r2_vision.test.mjs'),
  path.join(__dirname, 'r3_feeds.test.mjs'),
  path.join(__dirname, 'r4_medication.test.mjs')
];

let overallExitCode = 0;

for (const testFile of tests) {
  console.log(`\nExecuting test runner for: ${path.basename(testFile)}`);
  const child = spawn('node', [testFile], { stdio: 'inherit' });
  await new Promise((resolve) => {
    child.on('close', (code) => {
      if (code !== 0) {
        overallExitCode = code;
      }
      resolve();
    });
  });
}

if (overallExitCode !== 0) {
  console.error('\n❌ Test execution failed.');
  process.exit(overallExitCode);
} else {
  console.log('\n✅ All test suites executed successfully!');
  process.exit(0);
}
