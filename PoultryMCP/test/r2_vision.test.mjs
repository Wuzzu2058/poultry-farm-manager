import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

process.env.NODE_ENV = 'test';
const { app } = await import('../web_server.js');

console.log('🧪 Running R2 Vision API Test Suite...');

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

// 1. Inspect Frontend (web/index.html)
console.log('\n--- 1. Inspecting web/index.html UI Elements & Handlers ---');
const indexPath = path.join(PROJECT_ROOT, 'web', 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

assert(
  indexContent.includes('id="bird-image-input"'),
  'web/index.html contains image input element #bird-image-input'
);
assert(
  indexContent.includes('accept="image/*"'),
  '#bird-image-input specifies accept="image/*"'
);
assert(
  indexContent.includes('capture="environment"'),
  '#bird-image-input specifies capture="environment"'
);
assert(
  indexContent.includes('id="bird-image-preview"'),
  'web/index.html contains image preview element #bird-image-preview'
);
assert(
  indexContent.includes('id="bird-analysis-result"'),
  'web/index.html contains analysis output element #bird-analysis-result'
);
assert(
  indexContent.includes('Analyze Bird Photo with BXN Farm Advisor'),
  'web/index.html contains button "Analyze Bird Photo with BXN Farm Advisor"'
);
assert(
  indexContent.includes('analyzeBirdPhoto'),
  'web/index.html contains analyzeBirdPhoto JavaScript handler'
);
assert(
  indexContent.includes('FileReader') && indexContent.includes('readAsDataURL'),
  'web/index.html handles reading image file into Base64 Data URL'
);
assert(
  indexContent.includes('image: selectedBirdImageDataUrl'),
  'web/index.html includes base64 image in daily batch log object'
);

// 2. Inspect Backend Code Structure (web_server.js)
console.log('\n--- 2. Inspecting web_server.js Endpoint Implementation ---');
const serverPath = path.join(PROJECT_ROOT, 'web_server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

assert(
  serverContent.includes("app.post('/api/ai/vision'"),
  'web_server.js defines POST /api/ai/vision endpoint'
);
assert(
  serverContent.includes('meta/llama-3.2-11b-vision-instruct'),
  'web_server.js specifies model meta/llama-3.2-11b-vision-instruct'
);
assert(
  serverContent.includes('https://integrate.api.nvidia.com/v1/chat/completions'),
  'web_server.js targets NVIDIA NIM API endpoint https://integrate.api.nvidia.com/v1/chat/completions'
);
assert(
  serverContent.includes('process.env.NVIDIA_API_KEY'),
  'web_server.js retrieves process.env.NVIDIA_API_KEY'
);
assert(
  serverContent.includes('image_url') && serverContent.includes('url: imageUrl'),
  'web_server.js constructs OpenAI-compatible image_url payload structure'
);
assert(
  serverContent.includes('analysis') && serverContent.includes('remedies'),
  'web_server.js returns analysis and remedies in response'
);

// 3. Functional HTTP Endpoint & API Compliance Tests
console.log('\n--- 3. Running Live Server & API Compliance Tests ---');

const sampleBase64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const server = app.listen(0);
const port = server.address().port;
const baseUrl = `http://localhost:${port}`;

const originalFetch = globalThis.fetch;

try {
  // Test 3a: Fallback handling when NVIDIA_API_KEY is missing
  console.log('\n- Test 3a: Fallback handling when NVIDIA_API_KEY is missing');
  const originalApiKey = process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_API_KEY;

  const resFallback = await originalFetch(`${baseUrl}/api/ai/vision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl: sampleBase64Image })
  });

  assert(resFallback.status === 200, 'Endpoint responds with HTTP 200 on missing key fallback');
  const dataFallback = await resFallback.json();
  assert(dataFallback.success === true, 'Response indicates success: true for fallback');
  assert(typeof dataFallback.analysis === 'string' && dataFallback.analysis.length > 0, 'Response includes non-empty analysis text');
  assert(typeof dataFallback.remedies === 'string' && dataFallback.remedies.length > 0, 'Response includes non-empty remedies text');

  // Test 3b: Fallback handling when NVIDIA API fails
  console.log('\n- Test 3b: Fallback handling when NVIDIA API call fails');
  process.env.NVIDIA_API_KEY = "test_key_fail_mock";
  globalThis.fetch = async (url, options) => {
    if (url.includes('nvidia.com')) {
      return new Response('Internal NVIDIA Server Error 500', { status: 500 });
    }
    return originalFetch(url, options);
  };

  const resApiFail = await originalFetch(`${baseUrl}/api/ai/vision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl: sampleBase64Image })
  });

  assert(resApiFail.status === 200, 'Endpoint responds with HTTP 200 on API error fallback');
  const dataApiFail = await resApiFail.json();
  assert(dataApiFail.success === true, 'Response indicates success: true on API error fallback');
  assert(typeof dataApiFail.analysis === 'string' && dataApiFail.analysis.length > 0, 'Response includes non-empty fallback analysis');
  assert(typeof dataApiFail.remedies === 'string' && dataApiFail.remedies.length > 0, 'Response includes non-empty fallback remedies');

  // Test 3c: Request structure compliance & successful vision completion
  console.log('\n- Test 3c: NVIDIA NIM Vision payload structure & success response');
  process.env.NVIDIA_API_KEY = "nvapi-test-key-12345";
  let capturedUrl = "";
  let capturedHeaders = {};
  let capturedBody = {};

  globalThis.fetch = async (url, options) => {
    if (url.includes('nvidia.com')) {
      capturedUrl = url;
      capturedHeaders = options.headers || {};
      capturedBody = JSON.parse(options.body || '{}');

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: "Diagnosis: The flock shows mild lethargy consistent with early coccidiosis.\n\nRemedies: Administer amprolium in drinking water for 5 days and improve litter dryness."
            }
          }
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, options);
  };

  const resSuccess = await originalFetch(`${baseUrl}/api/ai/vision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl: sampleBase64Image })
  });

  assert(resSuccess.status === 200, 'Endpoint returns HTTP 200 on successful vision call');
  const dataSuccess = await resSuccess.json();

  assert(dataSuccess.success === true, 'Response contains success: true');
  assert(dataSuccess.analysis.includes('mild lethargy'), 'Response analysis contains model output');
  assert(dataSuccess.remedies.includes('amprolium'), 'Response remedies contains model output');

  assert(capturedUrl === 'https://integrate.api.nvidia.com/v1/chat/completions', 'API request target is https://integrate.api.nvidia.com/v1/chat/completions');
  assert(capturedHeaders['Authorization'] === 'Bearer nvapi-test-key-12345', 'API request Authorization header matches Bearer token');
  assert(capturedBody.model === 'meta/llama-3.2-11b-vision-instruct', 'API request model is meta/llama-3.2-11b-vision-instruct');
  assert(Array.isArray(capturedBody.messages) && capturedBody.messages.length === 1, 'API request messages payload is array with 1 user message');
  assert(capturedBody.messages[0].role === 'user', 'Message role is user');

  const contentArray = capturedBody.messages[0].content;
  assert(Array.isArray(contentArray) && contentArray.length === 2, 'Message content contains array of 2 items (text and image_url)');
  assert(contentArray[0].type === 'text' && typeof contentArray[0].text === 'string', 'First content item is text prompt');
  assert(contentArray[0].text.includes('poultry veterinarian'), 'Text prompt contains expert poultry veterinarian context');
  assert(contentArray[1].type === 'image_url' && contentArray[1].image_url?.url === sampleBase64Image, 'Second content item is image_url with matching base64 URL');

  // Test 3d: Payload via raw base64 and mimeType
  console.log('\n- Test 3d: Payload via raw base64 string and mimeType');
  const rawBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const resRaw = await originalFetch(`${baseUrl}/api/ai/vision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: rawBase64, mimeType: "image/png" })
  });

  assert(resRaw.status === 200, 'Endpoint handles raw image and mimeType payload');
  assert(capturedBody.messages[0].content[1].image_url.url === `data:image/png;base64,${rawBase64}`, 'Raw image converted to formatted base64 data URL in vision request payload');

  if (originalApiKey) process.env.NVIDIA_API_KEY = originalApiKey;
} finally {
  globalThis.fetch = originalFetch;
  server.close();
}

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 R2 Vision API Test Suite PASSED 100%!');
  process.exit(0);
}
