// Debug test to see raw API response structure for MCP tools
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

async function debugMCPResponse() {
  console.log('Debugging raw MCP API response...\n');

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultHeaders: {
      "anthropic-beta": "mcp-client-2025-04-04"
    }
  });

  const requestParams: any = {
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: 'What is the distance between New York and Boston? Please calculate it.'
      }
    ],
    mcp_servers: [
      {
        type: "url",
        url: "https://cf-template.alejoacelas.workers.dev/sse",
        name: "custom_screening_tools",
        tool_configuration: {
          enabled: true
        }
      }
    ],
    stream: true,
  };

  console.log('Request params:', JSON.stringify(requestParams, null, 2));
  console.log('\n--- Streaming Events ---\n');

  const stream = await client.messages.stream(requestParams);

  let eventCounter = 0;
  for await (const event of stream) {
    eventCounter++;
    console.log(`\nEvent #${eventCounter}:`, JSON.stringify(event, null, 2));
  }

  console.log('\n\n--- Final Message ---\n');
  const finalMessage = await stream.finalMessage();
  console.log(JSON.stringify(finalMessage, null, 2));

  console.log('\n\n--- Content Blocks Detail ---\n');
  if (finalMessage.content) {
    finalMessage.content.forEach((block: any, idx: number) => {
      console.log(`\nBlock #${idx + 1}:`);
      console.log(`  Type: ${block.type}`);
      console.log(`  Full block:`, JSON.stringify(block, null, 2));
    });
  }
}

debugMCPResponse().catch(console.error);
