// Test MCP tool usage - distance calculation between cities
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

async function testMCPDistanceCalculation() {
  console.log('Testing MCP tool usage for distance calculation...\n');
  console.log('='.repeat(80));
  console.log('Test: Calculate distance between two nearby cities');
  console.log('='.repeat(80));
  console.log();

  let completeResponse: SimplifiedResponse | null = null;
  let streamedText = '';

  console.log('--- Streaming Response ---\n');

  for await (const chunk of streamAnthropicResponse({
    model: 'claude-3-5-haiku-20241022',
    input: 'What is the distance between New York and Boston? Please calculate it.',
    instructions: 'Use the available tools to calculate the distance between the cities.',
    responseMode: 'markdown',
    webSearchEnabled: false,
    topP: 0.8
  })) {
    if (chunk.type === 'delta') {
      process.stdout.write(chunk.content);
      streamedText += chunk.content;
    } else if (chunk.type === 'complete') {
      completeResponse = chunk.response;
    } else if (chunk.type === 'error') {
      console.error('\nError:', chunk.error);
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('--- Complete Response Analysis ---');
  console.log('='.repeat(80));

  if (!completeResponse) {
    console.error('ERROR: No complete response received!');
    return;
  }

  // Display basic info
  console.log('\n1. Basic Information:');
  console.log(`   Model: ${completeResponse.model}`);
  console.log(`   Response ID: ${completeResponse.response_id || 'N/A'}`);
  console.log(`   Text length: ${completeResponse.text.length} characters`);

  if (completeResponse.usage) {
    console.log(`   Token usage: ${completeResponse.usage.total_tokens} total (${completeResponse.usage.input_tokens} input, ${completeResponse.usage.output_tokens} output)`);
  }

  // Check for tool calls
  console.log('\n2. Tool Calls:');
  console.log(`   Total tool calls: ${completeResponse.tool_calls.length}`);

  if (completeResponse.tool_calls.length > 0) {
    completeResponse.tool_calls.forEach((toolCall, idx) => {
      console.log(`\n   Tool Call #${idx + 1}:`);
      console.log(`     Name: ${toolCall.name}`);
      console.log(`     Arguments:`, JSON.stringify(toolCall.arguments, null, 6).split('\n').map((line, i) => i === 0 ? line : '       ' + line).join('\n'));
      console.log(`     Output:`, JSON.stringify(toolCall.output, null, 6).split('\n').map((line, i) => i === 0 ? line : '       ' + line).join('\n'));
    });
  } else {
    console.log('   ⚠️  No tool calls detected!');
  }

  // Check for annotations
  console.log('\n3. Annotations:');
  console.log(`   Total annotations: ${completeResponse.annotations.length}`);

  if (completeResponse.annotations.length > 0) {
    completeResponse.annotations.forEach((annotation, idx) => {
      console.log(`\n   Annotation #${idx + 1}:`);
      console.log(`     Type: ${annotation.type}`);
      console.log(`     Content: ${annotation.content}`);
      console.log(`     Source: ${annotation.source}`);
    });
  }

  // Verify MCP tool was used correctly
  console.log('\n' + '='.repeat(80));
  console.log('--- MCP Tool Verification ---');
  console.log('='.repeat(80));

  const mcpToolCalls = completeResponse.tool_calls.filter(tc =>
    tc.name !== 'web_search' && tc.name !== 'tool'
  );

  if (mcpToolCalls.length > 0) {
    console.log('\n✓ MCP tools were invoked!');
    mcpToolCalls.forEach((toolCall, idx) => {
      console.log(`\n  MCP Tool #${idx + 1}: ${toolCall.name}`);

      // Check if output was captured
      if (toolCall.output) {
        console.log('  ✓ Output was captured');
        console.log('  Output sample:', JSON.stringify(toolCall.output).substring(0, 200));
      } else {
        console.log('  ✗ Output was NOT captured (null or undefined)');
      }
    });
  } else {
    console.log('\n✗ No MCP tools were detected in tool calls!');
    console.log('  This could indicate:');
    console.log('  - The MCP server is not responding');
    console.log('  - The tool output extraction logic needs fixing');
    console.log('  - The model chose not to use the MCP tools');
  }

  // Display full response object for debugging
  console.log('\n' + '='.repeat(80));
  console.log('--- Full Response Object (JSON) ---');
  console.log('='.repeat(80));
  console.log(JSON.stringify(completeResponse, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('✓ Test completed!');
  console.log('='.repeat(80));
}

testMCPDistanceCalculation().catch(console.error);
