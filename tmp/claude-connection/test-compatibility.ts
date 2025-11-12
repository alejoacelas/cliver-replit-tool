// Test compatibility between OpenAI and Anthropic interfaces
import { readFileSync } from 'fs';
import { streamAnthropicResponse, type SimplifiedResponse } from './anthropic';

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

async function testCompatibility() {
  console.log('Testing compatibility with OpenAI interface...\n');

  // Test that the response structure matches what OpenAI returns
  console.log('Fetching response from Anthropic...');

  let completeResponse: SimplifiedResponse | null = null;

  for await (const chunk of streamAnthropicResponse({
    model: 'claude-3-5-haiku-20241022',
    input: 'Say hello and tell me your name.',
    instructions: 'Be concise.',
    responseMode: 'markdown',
    webSearchEnabled: false,
    topP: 0.8
  })) {
    if (chunk.type === 'delta') {
      process.stdout.write(chunk.content);
    } else if (chunk.type === 'complete') {
      completeResponse = chunk.response;
    } else if (chunk.type === 'error') {
      console.error('\nError:', chunk.error);
    }
  }

  console.log('\n\n--- Compatibility Check ---\n');

  if (!completeResponse) {
    console.error('ERROR: No complete response received!');
    return;
  }

  // Check required fields from SimplifiedResponse interface
  const checks = [
    { field: 'text', type: 'string', value: completeResponse.text },
    { field: 'tool_calls', type: 'array', value: completeResponse.tool_calls },
    { field: 'annotations', type: 'array', value: completeResponse.annotations },
    { field: 'model', type: 'string', value: completeResponse.model },
  ];

  console.log('Required fields:');
  checks.forEach(check => {
    const actualType = Array.isArray(check.value) ? 'array' : typeof check.value;
    const status = actualType === check.type ? '✓' : '✗';
    console.log(`  ${status} ${check.field}: ${actualType} (expected: ${check.type})`);
    if (check.type === 'string') {
      console.log(`      Value length: ${(check.value as string)?.length || 0} characters`);
    } else if (check.type === 'array') {
      console.log(`      Array length: ${(check.value as any[])?.length || 0} items`);
    }
  });

  console.log('\nOptional fields:');
  const optionalChecks = [
    { field: 'response_id', type: 'string', value: completeResponse.response_id },
    { field: 'usage', type: 'object', value: completeResponse.usage },
  ];

  optionalChecks.forEach(check => {
    if (check.value !== undefined && check.value !== null) {
      const actualType = typeof check.value;
      const status = actualType === check.type ? '✓' : '✗';
      console.log(`  ${status} ${check.field}: ${actualType} (expected: ${check.type})`);
      if (check.field === 'usage') {
        const usage = check.value as any;
        console.log(`      - total_tokens: ${usage.total_tokens}`);
        console.log(`      - input_tokens: ${usage.input_tokens}`);
        console.log(`      - output_tokens: ${usage.output_tokens}`);
      } else {
        console.log(`      Value: ${check.value}`);
      }
    } else {
      console.log(`  - ${check.field}: not present (optional)`);
    }
  });

  console.log('\n--- Structure Compatibility ---');

  // Verify the structure matches OpenAI's SimplifiedResponse
  const isCompatible =
    typeof completeResponse.text === 'string' &&
    Array.isArray(completeResponse.tool_calls) &&
    Array.isArray(completeResponse.annotations) &&
    typeof completeResponse.model === 'string' &&
    (completeResponse.response_id === undefined || typeof completeResponse.response_id === 'string') &&
    (completeResponse.usage === undefined || typeof completeResponse.usage === 'object');

  if (isCompatible) {
    console.log('✓ Response structure is COMPATIBLE with OpenAI interface!');
    console.log('✓ Can be used as drop-in replacement for OpenAI responses.');
  } else {
    console.log('✗ Response structure is NOT compatible!');
  }

  // Show sample of the complete response
  console.log('\n--- Sample Response Object ---');
  console.log(JSON.stringify({
    text: completeResponse.text.substring(0, 100) + (completeResponse.text.length > 100 ? '...' : ''),
    tool_calls: completeResponse.tool_calls,
    annotations: completeResponse.annotations,
    response_id: completeResponse.response_id,
    model: completeResponse.model,
    usage: completeResponse.usage
  }, null, 2));

  console.log('\n✓ Compatibility test completed!');
}

testCompatibility().catch(console.error);
