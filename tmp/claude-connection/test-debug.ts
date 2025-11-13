// Debug test to see raw API responses
import { readFileSync } from 'fs';
import Anthropic from "@anthropic-ai/sdk";

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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "anthropic-beta": "mcp-client-2025-04-04"
  }
});

console.log('='.repeat(80));
console.log('DEBUG TEST - RAW API EVENTS');
console.log('='.repeat(80));
console.log();

async function debugTest() {
  const query = "What is the current weather in San Francisco? Search the web.";

  console.log('Query:', query);
  console.log('-'.repeat(80));
  console.log();

  const requestParams = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: query
      }
    ],
    system: "Use web search to find current information.",
    tools: [{
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 5
    }],
    mcp_servers: [{
      type: "url",
      url: "https://cf-template.alejoacelas.workers.dev/sse",
      name: "custom_screening_tools",
      tool_configuration: {
        enabled: true
      }
    }],
    stream: true
  };

  console.log('Request params:', JSON.stringify(requestParams, null, 2));
  console.log();
  console.log('='.repeat(80));
  console.log('STREAMING EVENTS');
  console.log('='.repeat(80));
  console.log();

  try {
    const stream = await anthropic.messages.stream(requestParams as any);

    for await (const event of stream) {
      console.log('Event type:', event.type);
      console.log('Event data:', JSON.stringify(event, null, 2));
      console.log('-'.repeat(40));
    }

    console.log();
    console.log('='.repeat(80));
    console.log('FINAL MESSAGE');
    console.log('='.repeat(80));
    console.log();

    const finalMessage = await stream.finalMessage();
    console.log(JSON.stringify(finalMessage, null, 2));

  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

debugTest().catch(console.error);
