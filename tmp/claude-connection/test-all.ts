// Run all tests in sequence
import { readFileSync } from 'fs';
import { inferCustomerInfo, streamAnthropicResponse } from './anthropic';

// Load .env file manually
try {
  const envContent = readFileSync('/home/runner/workspace/.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  });
} catch (e) {
  console.log('Could not load .env file, using existing env vars');
}

console.log('='.repeat(80));
console.log('ANTHROPIC API INTEGRATION - COMPREHENSIVE TEST SUITE');
console.log('='.repeat(80));
console.log();

async function runAllTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Customer Info Inference
  console.log('TEST 1: Customer Info Inference');
  console.log('-'.repeat(80));

  try {
    const test1 = await inferCustomerInfo("Hi, I'm John Smith from Acme Corp.");
    if (test1.customerName === "John Smith" && test1.institution.includes("Acme Corp")) {
      console.log('✓ Full extraction test passed');
      testsPassed++;
    } else {
      console.log('✗ Full extraction test failed:', test1);
      testsFailed++;
    }

    const test2 = await inferCustomerInfo("I need help with the API.");
    if (test2.customerName === "Unknown client" && test2.institution === "Unknown institution") {
      console.log('✓ Default fallback test passed');
      testsPassed++;
    } else {
      console.log('✗ Default fallback test failed:', test2);
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ Customer info test failed:', error);
    testsFailed += 2;
  }

  console.log();

  // Test 2: Basic Streaming
  console.log('TEST 2: Basic Streaming Response');
  console.log('-'.repeat(80));

  try {
    let receivedDelta = false;
    let receivedComplete = false;
    let responseText = '';

    for await (const chunk of streamAnthropicResponse({
      model: 'claude-3-5-haiku-20241022',
      input: 'Say "test successful" and nothing else.',
      responseMode: 'markdown',
      webSearchEnabled: false
    })) {
      if (chunk.type === 'delta') {
        receivedDelta = true;
        responseText += chunk.content;
      } else if (chunk.type === 'complete') {
        receivedComplete = true;
      }
    }

    if (receivedDelta && receivedComplete && responseText.length > 0) {
      console.log('✓ Streaming test passed');
      console.log('  Response:', responseText.substring(0, 50) + '...');
      testsPassed++;
    } else {
      console.log('✗ Streaming test failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ Streaming test failed:', error);
    testsFailed++;
  }

  console.log();

  // Test 3: JSON Field Mode
  console.log('TEST 3: JSON Field Response Mode');
  console.log('-'.repeat(80));

  try {
    let completeResponse: any = null;

    for await (const chunk of streamAnthropicResponse({
      model: 'claude-3-5-haiku-20241022',
      input: 'What is 5+5? Respond with just the number.',
      instructions: 'Return a JSON object with a final_response field.',
      responseMode: 'json-field',
      webSearchEnabled: false
    })) {
      if (chunk.type === 'complete') {
        completeResponse = chunk.response;
      }
    }

    if (completeResponse && completeResponse.text) {
      console.log('✓ JSON field extraction test passed');
      console.log('  Extracted text:', completeResponse.text);
      testsPassed++;
    } else {
      console.log('✗ JSON field extraction test failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ JSON field test failed:', error);
    testsFailed++;
  }

  console.log();

  // Test 4: Response Structure
  console.log('TEST 4: Response Structure Compatibility');
  console.log('-'.repeat(80));

  try {
    let completeResponse: any = null;

    for await (const chunk of streamAnthropicResponse({
      model: 'claude-3-5-haiku-20241022',
      input: 'Hello',
      responseMode: 'markdown',
      webSearchEnabled: false
    })) {
      if (chunk.type === 'complete') {
        completeResponse = chunk.response;
      }
    }

    const hasRequiredFields =
      typeof completeResponse?.text === 'string' &&
      Array.isArray(completeResponse?.tool_calls) &&
      Array.isArray(completeResponse?.annotations) &&
      typeof completeResponse?.model === 'string';

    const hasUsage =
      typeof completeResponse?.usage?.total_tokens === 'number' &&
      typeof completeResponse?.usage?.input_tokens === 'number' &&
      typeof completeResponse?.usage?.output_tokens === 'number';

    if (hasRequiredFields && hasUsage) {
      console.log('✓ Response structure test passed');
      console.log('  Fields: text, tool_calls, annotations, model, usage ✓');
      testsPassed++;
    } else {
      console.log('✗ Response structure test failed');
      console.log('  Required fields:', hasRequiredFields);
      console.log('  Usage fields:', hasUsage);
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ Response structure test failed:', error);
    testsFailed++;
  }

  console.log();

  // Test 5: System Instructions
  console.log('TEST 5: System Instructions');
  console.log('-'.repeat(80));

  try {
    let responseText = '';

    for await (const chunk of streamAnthropicResponse({
      model: 'claude-3-5-haiku-20241022',
      input: 'What is your name?',
      instructions: 'Always respond with exactly: "I am Claude"',
      responseMode: 'markdown',
      webSearchEnabled: false
    })) {
      if (chunk.type === 'delta') {
        responseText += chunk.content;
      }
    }

    if (responseText.toLowerCase().includes('claude')) {
      console.log('✓ System instructions test passed');
      console.log('  Response includes "Claude" ✓');
      testsPassed++;
    } else {
      console.log('✗ System instructions test failed');
      console.log('  Response:', responseText);
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ System instructions test failed:', error);
    testsFailed++;
  }

  console.log();
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  console.log(`Passed: ${testsPassed} ✓`);
  console.log(`Failed: ${testsFailed} ✗`);
  console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));

  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Implementation is ready for production.\n');
  } else {
    console.log(`\n⚠️  ${testsFailed} test(s) failed. Please review the errors above.\n`);
  }
}

runAllTests().catch(console.error);
