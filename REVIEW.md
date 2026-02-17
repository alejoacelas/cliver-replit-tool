# Cliver Code Review

## What the app does

AI-powered customer screening platform for DNA/biotech providers. Users submit a customer name/description, the app fans out to OpenAI and/or Anthropic (with MCP tools for grant lookups, ORCID, screening lists), and streams back a background-check-style report.

## Bugs & issues

### The client doesn't actually stream — it polls

The SSE endpoint at `GET /api/responses/:responseId/stream` (routes.ts:317) exists but the client never connects to it. Instead, `home.tsx:52` uses `refetchInterval: 1000` to poll the database every second during streaming. This means:

- A 60-second response generates 60+ GET requests
- Latency: you only see updates every ~1s instead of token-by-token
- The SSE endpoint itself also polls the DB every 1s internally (routes.ts:330), so even if used, it's not real streaming

This is the biggest UX issue for a demo focused on making wait times feel short.

### Conversation title inference is fire-and-forget

`routes.ts:149` calls `inferAndUpdateConversationTitle()` without awaiting it. If it throws (e.g. OpenAI is down), the error is silently swallowed. The function also calls OpenAI's `inferCustomerInfo` even for Anthropic-only conversations — unclear why OpenAI is always the title generator.

### API key entropy is low

`routes.ts:386` generates keys with `crypto.randomBytes(16)` — 128 bits. Should be 32 bytes (256 bits) for security-critical tokens.

### Rate limit store is unbounded

`apiAuth.ts:12` — `rateLimitStore` is a plain object that grows with each unique API key. Cleanup runs every 5 minutes, but a burst of traffic with many keys can cause memory growth.

### N+1 queries in API request processing

`apiV1Routes.ts:487` — inside the streaming loop, it re-fetches ALL responses for a request on every delta event.

### `batchUpdateUserCallConfigs` is destructive

`storage.ts:227` — deletes all configs not in the provided list, then upserts. If accidentally called with an empty array, all user configs are wiped.

## Technical debt

### Massive unused UI component library

47 shadcn/ui components installed in `client/src/components/ui/`. Roughly 22 are never imported anywhere (accordion, avatar, badge, breadcrumb, carousel, chart, checkbox, command, context-menu, dropdown-menu, form, hover-card, input-otp, menubar, navigation-menu, pagination, progress, radio-group, resizable, separator, skeleton, tabs, toggle, toggle-group).

### Two separate API surfaces doing similar things

- `routes.ts` — serves the web UI (conversations, messages, configs, exports)
- `apiV1Routes.ts` — serves an external REST API (configs, requests)

Both have configuration CRUD. Both trigger AI calls. Both have streaming. The overlap is confusing and hard to keep in sync.

### OpenAI and Anthropic modules duplicate structure

`openai.ts` (288 lines) and `anthropic.ts` (365 lines) have near-identical patterns: build tools array, stream response, extract structured data. MCP tools are hardcoded identically in both files.

### Unused code

- `prompt.ts:1` — `NEW_CONFIG_PROMPT` is defined but never imported
- The export functionality (CSV + Excel) duplicates the same data transformation twice (routes.ts:227-296)
- `server/vite.ts` has an over-engineered custom logger and cache-busting UUID that don't add much

### Heavy dependencies for light use

- `xlsx` — only used for one export button
- `bcrypt` — only for API key hashing (could use built-in `crypto.scrypt`)
- `framer-motion` — imported but barely used
- `recharts`, `embla-carousel-react`, `react-day-picker`, `input-otp`, `cmdk`, `react-resizable-panels`, `vaul` — installed, most unused
- `passport`, `passport-local`, `openid-client` — full OAuth stack for Replit auth that won't work outside Replit

## Unclear decisions

### Why poll instead of stream?

The infrastructure for SSE exists. The AI SDKs support streaming. But the actual data path is: AI SDK streams → writes chunks to DB → client polls DB every 1s → renders. This adds latency and DB load for no benefit.

### Why multiple response cards per message?

The schema supports multiple `messageResponses` per message (for comparing models side-by-side). The UI renders them. But for a demo, this is complexity without payoff — it means the config system, the fan-out logic, and the polling all need to handle arrays.

### Replit Auth won't work locally

`replitAuth.ts` requires `REPLIT_DOMAINS` and `REPL_ID` env vars. Outside Replit, auth is completely bypassed (the middleware just calls `next()`). This means locally there are no users, which breaks conversation ownership. The landing page shows a "Sign in with Replit" button that does nothing locally.

### Why is `inferCustomerInfo` separate from the main AI call?

It makes a separate `gpt-4.1-nano` call just to extract a name and institution for the conversation title. This could be done as part of the main response, or skipped entirely for a demo.

## Simplification path for a lean demo

The core demo flow is: **user types query → AI streams back an answer → user sees it in real time**. Here's what's not needed for that:

### Remove entirely (~1,900 lines)

| What | Files/code | Lines |
|------|-----------|-------|
| API key system | `apiAuth.ts`, `api-keys.tsx`, key routes in `routes.ts` | ~450 |
| External API v1 | `apiV1Routes.ts` | ~545 |
| Export (CSV/Excel) | `ExportDialog.tsx`, export routes | ~250 |
| Config management UI | `ControlPanel.tsx` | ~306 |
| Conversation sidebar | `ConversationList.tsx` | ~107 |
| Title inference | `inferCustomerInfo` in `openai.ts`, call sites | ~50 |
| Unused UI components | 22 files in `components/ui/` | ~200 |

### Simplify significantly (~600 lines saved)

| What | Current | Simplified |
|------|---------|-----------|
| Streaming | Poll DB every 1s | Direct SSE from AI SDK to client |
| Schema | 8 tables | 3 tables (users, conversations, messages) |
| AI integration | Two 300-line modules | One module, one provider |
| Routes | 556-line monolith | ~150 lines for chat + auth |
| Storage | 495-line class with 30 methods | ~100 lines |

### The ideal minimal architecture

```
POST /api/chat  { message, conversationId? }
  → Server-Sent Events stream of tokens
  → Final event includes tool calls, sources, metadata

GET /api/conversations
GET /api/conversations/:id/messages
```

One AI provider (pick Anthropic or OpenAI). One config (hardcoded or from env). Direct SSE streaming from the SDK to the client — no DB writes during streaming, only save the final response.

For auth: simple session cookie with a "set your name" prompt, or just skip auth entirely for the demo.

### "Tricks to make wait time feel short"

These are the high-value UX changes for the demo:

1. **Real streaming** — show tokens as they arrive (currently delayed by 1s polling)
2. **Typing indicator / status line** — "Searching NIH grants...", "Checking screening lists..." as MCP tools execute
3. **Progressive rendering** — render markdown as it streams in (already partially done with `react-markdown`)
4. **Skeleton content** — show a pulsing placeholder immediately on submit

Items 1 and 2 require fixing the streaming architecture. Items 3 and 4 are frontend-only.
