/**
 * Standalone Razorpay credential test script.
 * Run from the backend/ directory: node razorpay-test.js
 *
 * This uses the same env-var loading that index.ts uses,
 * but makes an explicit fetch to Razorpay so we can diagnose
 * authentication failures independently.
 */

// ── Load .env (tries backend/.env first, then project-root ../.env) ──────────
const path = require('path');
const fs   = require('fs');

const localEnv  = path.join(__dirname, '.env');
const parentEnv = path.join(__dirname, '..', '.env');

if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv });
  console.log('[test] Loaded .env from:', localEnv);
} else if (fs.existsSync(parentEnv)) {
  require('dotenv').config({ path: parentEnv });
  console.log('[test] Loaded .env from:', parentEnv, '(project root)');
} else {
  console.log('[test] No .env file found — relying on shell environment');
}

// ── Diagnostics ───────────────────────────────────────────────────────────────
const keyId     = process.env.RAZORPAY_KEY_ID     || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

console.log('\n=== Razorpay Credential Diagnostics ===');
console.log('RAZORPAY_KEY_ID     :', keyId   ? '"' + keyId + '"' : '❌ NOT SET');
console.log('RAZORPAY_KEY_SECRET : length =', keySecret ? keySecret.length : '❌ NOT SET');
console.log('KEY_ID trimmed      :', JSON.stringify(keyId.trim()));
console.log('SECRET trimmed len  :', keySecret.trim().length);
console.log('KEY_ID === trimmed? :', keyId === keyId.trim());
console.log('SECRET === trimmed? :', keySecret === keySecret.trim());

// Detect common hidden-character issues
const hiddenCharsId     = [...keyId].filter(c => c.charCodeAt(0) > 127 || c.charCodeAt(0) < 32).length;
const hiddenCharsSecret = [...keySecret].filter(c => c.charCodeAt(0) > 127 || c.charCodeAt(0) < 32).length;
console.log('Hidden chars in KEY_ID     :', hiddenCharsId);
console.log('Hidden chars in KEY_SECRET :', hiddenCharsSecret);

if (!keyId || !keySecret) {
  console.error('\n❌ Credentials are missing. Cannot test. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  process.exit(1);
}

// ── Test Razorpay API call ────────────────────────────────────────────────────
const cleanId     = keyId.trim();
const cleanSecret = keySecret.trim();
const basicAuth   = Buffer.from(cleanId + ':' + cleanSecret).toString('base64');

console.log('\n=== Calling Razorpay Orders API ===');
console.log('Auth header prefix (safe):', 'Basic ' + basicAuth.slice(0, 10) + '...');

async function testRazorpay() {
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basicAuth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: 100,        // Rs.1 in paise
      currency: 'INR',
      receipt: 'test_receipt_standalone',
    }),
  });

  const body = await response.json();

  if (response.ok) {
    console.log('\n✅ SUCCESS — Razorpay order created!');
    console.log('Order ID:', body.id);
    console.log('Status  :', body.status);
  } else {
    console.error('\n❌ FAILURE — Razorpay rejected the request');
    console.error('HTTP status:', response.status);
    console.error('Response   :', JSON.stringify(body, null, 2));

    if (body && body.error && body.error.code === 'BAD_REQUEST_ERROR' && body.error.description === 'Authentication failed') {
      console.error('\n🔍 Root cause: The key_id/secret combination is invalid.');
      console.error('   Possible reasons:');
      console.error('   1. The credentials in Render env vars do not match the Razorpay dashboard.');
      console.error('   2. The credentials are for a different Razorpay account/mode (test vs live).');
      console.error('   3. The API key has been regenerated or deleted in Razorpay dashboard.');
      console.error('   4. There are invisible whitespace characters in the Render env var values.');
      console.error('\n   Action: Go to https://dashboard.razorpay.com/app/keys');
      console.error('   Regenerate the key and update Render env vars manually.');
    }
  }
}

testRazorpay().catch(function(err) {
  console.error('Fetch error:', err);
  process.exit(1);
});
