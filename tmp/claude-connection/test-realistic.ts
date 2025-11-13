// Realistic test for Vanessa Vang screening query
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

console.log('='.repeat(80));
console.log('REALISTIC TEST: Vanessa Vang Screening Query');
console.log('='.repeat(80));
console.log();

async function runRealisticTest() {
  const personInfo = {
    name: "Vanessa Vang",
    email: "vanessa@terrainbiosciences.com",
    company: "terrainbiosciences.com",
    role: "Research Associate II @ Terrain Biosciences"
  };

  const query = `Please screen this person for sanctions and proscribed entities:

Name: ${personInfo.name}
Email: ${personInfo.email}
Company Domain: ${personInfo.company}
Role: ${personInfo.role}

I need to know:
1. Are there any previous publications by this person?
2. Is this person or their company on any proscribed entities list?
3. What information can you find about their company, Terrain Biosciences?`;

  console.log('Query:', query);
  console.log('-'.repeat(80));
  console.log();

  let deltaCount = 0;
  let responseText = '';
  let completeResponse: any = null;

  try {
    console.log('Starting streaming request with MCP connector + web search...');
    console.log();

    for await (const chunk of streamAnthropicResponse({
      model: 'claude-sonnet-4-5-20250929',
      input: query,
      instructions: 'You are a helpful assistant that performs comprehensive screening checks. Use web search to find information about publications, sanctions lists, and company information. Use the MCP screening tools if available.',
      responseMode: 'markdown',
      webSearchEnabled: true
    })) {
      if (chunk.type === 'delta') {
        deltaCount++;
        responseText += chunk.content;
        process.stdout.write(chunk.content);
      } else if (chunk.type === 'complete') {
        completeResponse = chunk.response;
      } else if (chunk.type === 'error') {
        console.error('\n\nERROR:', chunk.error);
        return;
      }
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('RESPONSE ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    if (completeResponse) {
      console.log('Response ID:', completeResponse.response_id);
      console.log('Model:', completeResponse.model);
      console.log();

      console.log('Usage:');
      console.log('  Input tokens:', completeResponse.usage?.input_tokens || 0);
      console.log('  Output tokens:', completeResponse.usage?.output_tokens || 0);
      console.log('  Total tokens:', completeResponse.usage?.total_tokens || 0);
      console.log();

      console.log('Tool Calls:', completeResponse.tool_calls.length);
      if (completeResponse.tool_calls.length > 0) {
        completeResponse.tool_calls.forEach((tc: any, idx: number) => {
          console.log(`\n  Tool ${idx + 1}: ${tc.name}`);
          console.log('  Arguments:', JSON.stringify(tc.arguments, null, 2).split('\n').map((l: string) => '    ' + l).join('\n'));
          if (tc.output) {
            const outputStr = typeof tc.output === 'string'
              ? tc.output
              : JSON.stringify(tc.output, null, 2);
            const outputPreview = outputStr.substring(0, 200);
            console.log('  Output preview:', outputPreview + (outputStr.length > 200 ? '...' : ''));
          }
        });
      }
      console.log();

      console.log('Annotations:', completeResponse.annotations.length);
      if (completeResponse.annotations.length > 0) {
        completeResponse.annotations.slice(0, 5).forEach((ann: any, idx: number) => {
          console.log(`\n  Annotation ${idx + 1}:`);
          console.log('    Type:', ann.type);
          console.log('    Content:', ann.content.substring(0, 100) + (ann.content.length > 100 ? '...' : ''));
          console.log('    Source:', ann.source);
        });
        if (completeResponse.annotations.length > 5) {
          console.log(`\n  ... and ${completeResponse.annotations.length - 5} more annotations`);
        }
      }
      console.log();

      console.log('Text length:', completeResponse.text.length);
      console.log('Delta chunks received:', deltaCount);
      console.log();

      // Analysis
      console.log('='.repeat(80));
      console.log('TEST RESULTS');
      console.log('='.repeat(80));
      console.log();

      const hasText = completeResponse.text.length > 0;
      const hasToolCalls = completeResponse.tool_calls.length > 0;
      const hasWebSearch = completeResponse.tool_calls.some((tc: any) => tc.name === 'web_search');
      const hasMCPTools = completeResponse.tool_calls.some((tc: any) => tc.name !== 'web_search');

      console.log('✓ Response received:', hasText ? 'YES' : 'NO');
      console.log('✓ Tool calls made:', hasToolCalls ? 'YES' : 'NO');
      console.log('✓ Web search used:', hasWebSearch ? 'YES' : 'NO');
      console.log('✓ MCP tools used:', hasMCPTools ? 'YES' : 'NO');
      console.log();

      if (!hasToolCalls) {
        console.log('⚠️  WARNING: No tool calls were made!');
        console.log('   The model may have responded without using any tools.');
        console.log('   This could indicate:');
        console.log('   - Tools were not properly configured in the request');
        console.log('   - Model decided not to use tools');
        console.log('   - API parameter mismatch');
      }

      if (hasWebSearch) {
        console.log('✓ Web search functionality is working!');
      }

      if (hasMCPTools) {
        console.log('✓ MCP connector is working!');
      }
    } else {
      console.log('✗ No complete response received');
    }

  } catch (error) {
    console.error('\nTest failed with error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

runRealisticTest().catch(console.error);
