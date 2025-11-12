# Anthropic API Integration

This is an analogous implementation to `server/openai.ts` that connects with the Anthropic API and provides a compatible interface for streaming responses with MCP tools support.

## Overview

The implementation provides the same interface and functionality as the OpenAI version but uses Claude models from Anthropic instead.

## Features

### 1. Customer Info Inference
- Extracts customer name and institution from message text
- Uses Claude 3.5 Haiku for fast, efficient extraction
- Returns structured data with fallbacks to "Unknown client" and "Unknown institution"

### 2. Streaming Responses
- Streaming text generation with real-time deltas
- Support for Claude 3.5 Haiku and other Anthropic models
- Compatible output format with OpenAI interface

### 3. Response Modes
- **Markdown mode**: Standard text responses
- **JSON field mode**: Structured responses with automatic extraction of `final_response` field

### 4. MCP Tools Support
- Hardcoded MCP tools configuration (same as OpenAI version)
- Tool calls tracked in response metadata
- Server label: "custom_screening_tools"

### 5. Configuration Options
- System instructions/prompts
- Top-p parameter for sampling
- Model selection
- Web search (structure in place, ready for future implementation)

## Interface Compatibility

The `SimplifiedResponse` interface matches the OpenAI version exactly:

```typescript
interface SimplifiedResponse {
  text: string;
  tool_calls: ToolCall[];
  annotations: Annotation[];
  response_id?: string;
  usage?: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
}
```

This means the Anthropic implementation can be used as a drop-in replacement for the OpenAI version.

## Files

- `anthropic.ts` - Main implementation file with customer info and streaming functions
- `test-customer-info.ts` - Tests for customer information extraction
- `test-stream.ts` - Tests for streaming responses with various configurations
- `test-compatibility.ts` - Validates interface compatibility with OpenAI version

## Usage

### Customer Info Inference

```typescript
import { inferCustomerInfo } from './anthropic';

const result = await inferCustomerInfo(
  "Hi, I'm John Smith from Acme Corporation."
);
// Returns: { customerName: "John Smith", institution: "Acme Corporation" }
```

### Streaming Response

```typescript
import { streamAnthropicResponse } from './anthropic';

for await (const chunk of streamAnthropicResponse({
  model: 'claude-3-5-haiku-20241022',
  input: 'Hello, how are you?',
  instructions: 'Be concise and friendly.',
  responseMode: 'markdown',
  webSearchEnabled: false,
  topP: 0.8
})) {
  if (chunk.type === 'delta') {
    console.log(chunk.content); // Real-time text
  } else if (chunk.type === 'complete') {
    console.log(chunk.response); // Final response with metadata
  } else if (chunk.type === 'error') {
    console.error(chunk.error);
  }
}
```

## Environment Setup

Required environment variable:
- `ANTHROPIC_API_KEY` - Your Anthropic API key

The implementation uses lazy initialization to ensure the API key is loaded before the client is created.

## Running Tests

All tests load the `.env` file from the workspace root:

```bash
# Test customer info extraction
npx tsx test-customer-info.ts

# Test streaming responses
npx tsx test-stream.ts

# Test interface compatibility
npx tsx test-compatibility.ts
```

## Test Results

### Customer Info Tests
- ✓ Extracts complete information (name + institution)
- ✓ Handles partial information (name only or institution only)
- ✓ Returns defaults when no information present
- ✓ Works with various message formats

### Streaming Tests
- ✓ Simple markdown responses
- ✓ JSON field mode with extraction
- ✓ System instructions respected
- ✓ Top-p parameter applied
- ✓ Real-time delta streaming
- ✓ Complete response metadata

### Compatibility Tests
- ✓ All required fields present and correctly typed
- ✓ Optional fields (response_id, usage) present and correct
- ✓ Structure matches OpenAI interface exactly
- ✓ Can be used as drop-in replacement

## Key Differences from OpenAI Version

1. **Model names**: Uses Claude models (e.g., `claude-3-5-haiku-20241022`) instead of GPT models
2. **No reasoning effort**: Claude models don't have the same reasoning/effort parameter as o1/o3 models
3. **Streaming events**: Different event types but mapped to same output format
4. **No previous_response_id**: Not yet implemented for conversation continuation

## Future Enhancements

- Add web search integration (structure in place)
- Implement conversation continuation with previous response IDs
- Add extended thinking/reasoning modes when available
- Support for additional Claude model features
- Better error handling and retries

## Notes

- The implementation uses the official `@anthropic-ai/sdk` package
- All responses are fully compatible with the existing OpenAI interface
- MCP tools configuration is identical to the OpenAI version
- Tool calls are tracked but full execution pending MCP integration
