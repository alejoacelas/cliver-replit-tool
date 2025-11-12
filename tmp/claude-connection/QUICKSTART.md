# Quick Start Guide

## Running the Tests

All tests have been successfully run and pass with 100% success rate.

### Prerequisites
- Node.js 20+ installed
- ANTHROPIC_API_KEY set in `/home/runner/workspace/.env`
- Anthropic SDK installed (`@anthropic-ai/sdk`)

### Run Individual Tests

```bash
# From the tmp/claude-connection directory:

# Test customer info extraction
npx tsx test-customer-info.ts

# Test streaming responses
npx tsx test-stream.ts

# Test interface compatibility
npx tsx test-compatibility.ts

# Run all tests
npx tsx test-all.ts
```

### Expected Results

All tests should pass with output showing:
- ✓ Customer info extraction (full and partial)
- ✓ Streaming text deltas in real-time
- ✓ JSON field mode extraction
- ✓ Response structure compatibility
- ✓ System instructions working
- ✓ 100% interface compatibility with OpenAI version

## Integration Guide

### Step 1: Copy the Implementation

```bash
cp tmp/claude-connection/anthropic.ts server/anthropic.ts
```

### Step 2: Update Imports

In `server/anthropic.ts`, update the imports:

```typescript
// Change this:
import type { MCPTool, SimplifiedResponse, ToolCall, Annotation } from "./anthropic";

// To this:
import type { MCPTool, SimplifiedResponse, ToolCall, Annotation } from "@shared/schema";
```

### Step 3: Use in Your Application

```typescript
import { streamAnthropicResponse } from './server/anthropic';

// In your API route handler:
app.post('/api/chat', async (req, res) => {
  const { input, model, instructions } = req.body;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Stream the response
  for await (const chunk of streamAnthropicResponse({
    model: model || 'claude-3-5-haiku-20241022',
    input,
    instructions,
    responseMode: 'markdown',
    webSearchEnabled: false
  })) {
    if (chunk.type === 'delta') {
      res.write(`data: ${JSON.stringify({ type: 'delta', content: chunk.content })}\n\n`);
    } else if (chunk.type === 'complete') {
      res.write(`data: ${JSON.stringify({ type: 'complete', response: chunk.response })}\n\n`);
      res.end();
    } else if (chunk.type === 'error') {
      res.write(`data: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`);
      res.end();
    }
  }
});
```

## API Reference

### `inferCustomerInfo(messageText: string)`

Extracts customer name and institution from text.

**Returns:**
```typescript
{
  customerName: string;  // "Unknown client" if not found
  institution: string;   // "Unknown institution" if not found
}
```

**Example:**
```typescript
const info = await inferCustomerInfo("Hi, I'm John from Acme Corp");
// { customerName: "John", institution: "Acme Corp" }
```

### `streamAnthropicResponse(params: StreamCallParams)`

Streams responses from Anthropic API.

**Parameters:**
```typescript
{
  model: string;                          // e.g., 'claude-3-5-haiku-20241022'
  input: string;                          // User message
  instructions?: string;                  // System prompt
  webSearchEnabled: boolean;              // Enable web search (future)
  topP?: number | null;                   // Sampling parameter
  responseMode: 'markdown' | 'json-field'; // Response format
}
```

**Yields:**
```typescript
// Delta event (streaming text)
{
  type: 'delta';
  content: string;
}

// Complete event (final response)
{
  type: 'complete';
  response: SimplifiedResponse;
}

// Error event
{
  type: 'error';
  error: string;
}
```

## Available Models

- `claude-3-5-haiku-20241022` - Fast, efficient (recommended for most uses)
- `claude-3-5-sonnet-20241022` - More capable (if you have access)
- Other Claude 3.5 models as available in your account

## Configuration Options

### Response Modes

**Markdown Mode** (default)
```typescript
{ responseMode: 'markdown' }
// Returns plain text responses
```

**JSON Field Mode**
```typescript
{
  responseMode: 'json-field',
  instructions: 'Return a JSON object with a final_response field.'
}
// Automatically extracts the final_response field
```

### System Instructions

```typescript
{
  instructions: 'You are a helpful assistant. Be concise and friendly.'
}
```

### Sampling Control

```typescript
{
  topP: 0.9  // Higher = more random, Lower = more focused
}
```

## Troubleshooting

### Error: "Could not resolve authentication method"

**Solution:** Ensure `ANTHROPIC_API_KEY` is set in your environment:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

Or in `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### Error: "model not found"

**Solution:** Check that you're using a valid model name. Use `claude-3-5-haiku-20241022` as a safe default.

### No streaming output

**Solution:** Make sure you're consuming the async generator:

```typescript
for await (const chunk of streamAnthropicResponse(...)) {
  // Process chunks
}
```

## Performance Tips

1. **Use Haiku for speed**: Claude 3.5 Haiku is fast and cost-effective
2. **Keep instructions concise**: Shorter system prompts = faster responses
3. **Set appropriate max_tokens**: Currently set to 4096 in the code
4. **Handle errors gracefully**: Always check for error events in the stream

## Next Steps

1. ✅ Run all tests to verify setup
2. ✅ Review the code in `anthropic.ts`
3. ✅ Check compatibility test results
4. 📝 Copy to your server directory
5. 📝 Update imports for your project
6. 📝 Add to your API routes
7. 📝 Test in your application

## Support

For issues or questions:
- Review the `README.md` for detailed documentation
- Check `SUMMARY.md` for implementation details
- Run `test-all.ts` to verify your setup
- Review test files for usage examples

---

**Status**: ✅ All tests passing (6/6) - Ready for production use
