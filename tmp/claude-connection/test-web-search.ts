// Test specifically for web search functionality
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
console.log('WEB SEARCH TEST');
console.log('='.repeat(80));
console.log();

async function testWebSearch() {
  const query = "What are the latest news about Terrain Biosciences? Search the web for recent announcements.";

  console.log('Query:', query);
  console.log('-'.repeat(80));
  console.log();

  let responseText = '';
  let completeResponse: any = null;

  try {
    console.log('Starting streaming request with web search enabled...');
    console.log();

    for await (const chunk of streamAnthropicResponse({
      model: 'claude-sonnet-4-5-20250929',
      input: query,
      instructions: 'Use web search to find current information.',
      responseMode: 'markdown',
      webSearchEnabled: true
    })) {
      if (chunk.type === 'delta') {
        responseText += chunk.content;
        process.stdout.write(chunk.content);
      } else if (chunk.type === 'complete') {
        completeResponse = chunk.response;
        console.log('\n\n' + '='.repeat(80));
        console.log('COMPLETE RESPONSE OBJECT');
        console.log('='.repeat(80));
        console.log(JSON.stringify(completeResponse, null, 2));
      } else if (chunk.type === 'error') {
        console.error('\n\nERROR:', chunk.error);
        return;
      }
    }

  } catch (error) {
    console.error('\nTest failed with error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

testWebSearch().catch(console.error);
