# Cliver - AI Background Research Platform

## Overview

Cliver is an AI-powered customer background research tool that enables users to query multiple AI models simultaneously and receive parallel, real-time streaming responses. The platform is designed for B2B research workflows, providing comprehensive insights through multi-model analysis with intelligent web search and custom MCP (Model Context Protocol) tool integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Tooling**
- React 18 with TypeScript for type safety and modern component patterns
- Vite for fast development builds and optimized production bundles
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and intelligent caching

**UI Component System**
- shadcn/ui component library (New York variant) providing accessible, customizable Radix UI primitives
- Tailwind CSS for utility-first styling with custom design system
- Design philosophy: Linear-inspired productivity aesthetic with ChatGPT-like conversational patterns
- Dark mode primary with light mode support
- Custom color palette centered around vibrant purple primary (262 83% 58%)

**State Management Pattern**
- Server state managed via React Query with aggressive caching
- Local UI state using React hooks (useState, useEffect)
- Real-time streaming responses stored in component-level Map state
- Session-based authentication state synchronized with backend

### Backend Architecture

**Core Stack**
- Node.js with Express for RESTful API endpoints
- TypeScript throughout for type consistency with frontend
- Server-Sent Events (SSE) for real-time streaming responses from AI models
- PostgreSQL (via Neon) for persistent data storage with WebSocket support

**Authentication & Session Management**
- Replit Auth (OpenID Connect) for user authentication
- Passport.js strategy for OIDC integration
- PostgreSQL-backed session storage using connect-pg-simple
- Session cookies with 7-day TTL, httpOnly and secure flags

**Database Layer**
- Drizzle ORM for type-safe database queries and migrations
- Schema includes: users, conversations, messages, messageResponses, userCallConfigs, sessions
- Relational data model with foreign key constraints and cascade deletes
- Neon serverless PostgreSQL with WebSocket constructor for connection pooling

**AI Integration Strategy**
- OpenAI Responses API as primary interface
- Multi-response system: single user query triggers multiple simultaneous AI calls with different configurations
- Hardcoded MCP tools for custom screening capabilities (custom_screening_tools server)
- Web search integration as optional tool per configuration
- Support for reasoning models (o1, o3) with configurable reasoning effort levels
- Real-time SSE streaming with chunked response delivery

### Data Flow Patterns

**Request-Response Cycle**
1. User submits query → creates conversation if new
2. Backend creates message record
3. For each enabled user call config:
   - Initiates OpenAI Responses API call with specific model/settings
   - Creates messageResponse record with "streaming" status
   - Streams chunks via SSE to frontend
4. Frontend displays responses in parallel cards with real-time updates
5. On completion, updates messageResponse status to "completed"

**Tool Execution Flow**
- MCP tools defined via server_label and server_url
- Web search automatically available when enabled in config
- Tool calls and results stored in messageResponse.toolCalls as JSONB
- Annotations (citations, URLs) extracted and displayed separately

### Key Architectural Decisions

**Multi-Model Response System**
- **Problem**: Users need comprehensive research from multiple AI perspectives
- **Solution**: UserCallConfig table stores per-user AI configurations (model, prompt, reasoning, tools)
- **Rationale**: Allows customization without code changes; each config generates independent response card
- **Trade-offs**: Increased API costs but provides richer insights

**Server-Sent Events for Streaming**
- **Problem**: Real-time display of AI responses as they generate
- **Solution**: SSE endpoint streams chunks with type markers (chunk, complete, error)
- **Rationale**: Simpler than WebSockets for unidirectional streaming; HTTP/1.1 compatible
- **Trade-offs**: One-way communication only; requires connection per active stream

**Conversation-Based Organization**
- **Problem**: Managing chat history across sessions
- **Solution**: Hierarchical structure: Conversation → Messages → MessageResponses
- **Rationale**: Mirrors ChatGPT/Claude UX patterns users expect
- **Trade-offs**: More database relationships but clearer data model

**Per-User Call Configurations**
- **Problem**: Different users need different AI setups
- **Solution**: userCallConfigs table with JSON fields for flexible parameters
- **Rationale**: Enables "developer mode" control panel without schema migrations
- **Trade-offs**: JSON fields less queryable but more flexible

## External Dependencies

### Third-Party Services

**OpenAI API**
- Purpose: Primary AI model provider
- Models used: GPT-5 (default), O1, O3 reasoning models
- Features: Responses API, web search tool, MCP tool integration
- Authentication: API key via environment variable

**Neon Serverless PostgreSQL**
- Purpose: Primary database
- Features: WebSocket-based connections, automatic scaling
- Connection: Via DATABASE_URL environment variable with SSL

**Replit Authentication (OIDC)**
- Purpose: User authentication and session management
- Provider: Replit's OpenID Connect service
- Configuration: REPL_ID, ISSUER_URL, SESSION_SECRET environment variables
- Integration: Passport.js strategy with custom verification

### NPM Dependencies (Key Packages)

**UI & Components**
- @radix-ui/* (v1.x): Accessible component primitives for dialogs, dropdowns, etc.
- react-markdown: Markdown rendering for AI responses
- cmdk: Command palette component
- lucide-react: Icon library

**Data & State**
- @tanstack/react-query (v5): Server state management and caching
- drizzle-orm (v0.39): Type-safe ORM
- @neondatabase/serverless (v0.10): Neon database client
- ws: WebSocket implementation for database connections

**Forms & Validation**
- react-hook-form: Form state management
- @hookform/resolvers: Validation resolver integration
- zod: Schema validation
- drizzle-zod: Generate Zod schemas from Drizzle tables

**Backend Infrastructure**
- express: HTTP server framework
- passport: Authentication middleware
- openid-client: OIDC protocol implementation
- connect-pg-simple: PostgreSQL session store
- memoizee: Function memoization for OIDC config

**Development Tools**
- vite: Build tool and dev server
- tsx: TypeScript execution for Node.js
- esbuild: Production bundling
- tailwindcss: CSS framework
- autoprefixer: CSS vendor prefixing

### MCP Tools Integration

**Custom Screening Tools Server**
- Server Label: custom_screening_tools
- Server URL: https://cf-template.alejoacelas.workers.dev/sse
- Approval: Never required (automatic execution)
- Purpose: Domain-specific customer screening capabilities
- Integration: Passed to OpenAI Responses API as MCP tool type