// Test customer info inference
import { readFileSync } from 'fs';
import { inferCustomerInfo } from './anthropic';

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

async function testCustomerInfo() {
  console.log('Testing customer info inference...\n');

  // Test 1: Complete information
  const test1 = "Hi, I'm John Smith from Acme Corporation. We need help with our screening process.";
  console.log('Test 1 - Complete info:');
  console.log('Input:', test1);
  const result1 = await inferCustomerInfo(test1);
  console.log('Result:', JSON.stringify(result1, null, 2));
  console.log('---\n');

  // Test 2: Partial information
  const test2 = "Hello, this is Sarah. I work at TechStartup Inc.";
  console.log('Test 2 - Partial info:');
  console.log('Input:', test2);
  const result2 = await inferCustomerInfo(test2);
  console.log('Result:', JSON.stringify(result2, null, 2));
  console.log('---\n');

  // Test 3: No information
  const test3 = "I need help with the API integration.";
  console.log('Test 3 - No info:');
  console.log('Input:', test3);
  const result3 = await inferCustomerInfo(test3);
  console.log('Result:', JSON.stringify(result3, null, 2));
  console.log('---\n');

  // Test 4: Only name
  const test4 = "My name is Michael Johnson and I have a question.";
  console.log('Test 4 - Only name:');
  console.log('Input:', test4);
  const result4 = await inferCustomerInfo(test4);
  console.log('Result:', JSON.stringify(result4, null, 2));
  console.log('---\n');

  console.log('Customer info tests completed!');
}

testCustomerInfo().catch(console.error);
