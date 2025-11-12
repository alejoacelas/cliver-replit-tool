// Test streaming response
import { readFileSync } from 'fs';
import { streamAnthropicResponse } from './anthropic';

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

async function testStreaming() {
  console.log('Testing streaming response...\n');

  // Test 1: Simple markdown response
  console.log('Test 1 - Simple markdown response:');
  console.log('Input: "Explain what MCP tools are in 2 sentences."\n');

  let streamedText = '';
  let completeResponse: any = null;

  for await (const chunk of streamAnthropicResponse({
    model: 'claude-3-5-haiku-20241022',
    input: 'Explain what MCP tools are in 2 sentences.',
    responseMode: 'markdown',
    webSearchEnabled: false
  })) {
    if (chunk.type === 'delta') {
      streamedText += chunk.content;
      process.stdout.write(chunk.content);
    } else if (chunk.type === 'complete') {
      completeResponse = chunk.response;
    } else if (chunk.type === 'error') {
      console.error('\nError:', chunk.error);
    }
  }

  console.log('\n\n--- Complete Response ---');
  console.log('Response ID:', completeResponse?.response_id);
  console.log('Model:', completeResponse?.model);
  console.log('Usage:', JSON.stringify(completeResponse?.usage, null, 2));
  console.log('Tool calls:', completeResponse?.tool_calls?.length || 0);
  console.log('Annotations:', completeResponse?.annotations?.length || 0);
  console.log('---\n');

  // Test 2: JSON field mode
  console.log('Test 2 - JSON field response mode:');
  console.log('Input: "What is 2+2?"\n');

  streamedText = '';
  completeResponse = null;

  for await (const chunk of streamAnthropicResponse({
    model: 'claude-3-5-haiku-20241022',
    input: 'What is 2+2? Be concise.',
    instructions: 'You must respond with a JSON object containing a "final_response" field.',
    responseMode: 'json-field',
    webSearchEnabled: false
  })) {
    if (chunk.type === 'delta') {
      streamedText += chunk.content;
      process.stdout.write(chunk.content);
    } else if (chunk.type === 'complete') {
      completeResponse = chunk.response;
    } else if (chunk.type === 'error') {
      console.error('\nError:', chunk.error);
    }
  }

  console.log('\n\n--- Complete Response ---');
  console.log('Response ID:', completeResponse?.response_id);
  console.log('Model:', completeResponse?.model);
  console.log('Extracted text:', completeResponse?.text);
  console.log('Usage:', JSON.stringify(completeResponse?.usage, null, 2));
  console.log('---\n');

  // Test 3: With system instructions
  console.log('Test 3 - With system instructions:');
  console.log('Input: "Hello!"\n');

  streamedText = '';
  completeResponse = null;

  for await (const chunk of streamAnthropicResponse({
    model: 'claude-3-5-haiku-20241022',
    input: 'Hello!',
    instructions: 'You are a pirate. Always respond in pirate speak.',
    responseMode: 'markdown',
    webSearchEnabled: false,
    topP: 0.9
  })) {
    if (chunk.type === 'delta') {
      streamedText += chunk.content;
      process.stdout.write(chunk.content);
    } else if (chunk.type === 'complete') {
      completeResponse = chunk.response;
    } else if (chunk.type === 'error') {
      console.error('\nError:', chunk.error);
    }
  }

  console.log('\n\n--- Complete Response ---');
  console.log('Response ID:', completeResponse?.response_id);
  console.log('Model:', completeResponse?.model);
  console.log('Usage:', JSON.stringify(completeResponse?.usage, null, 2));
  console.log('---\n');

  console.log('Streaming tests completed!');
}

testStreaming().catch(console.error);
