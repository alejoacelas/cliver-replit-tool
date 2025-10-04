# Cliver Design Guidelines

## Design Approach
**System Selection**: Linear-inspired modern productivity aesthetic combined with ChatGPT's conversational interface patterns.

**Core Philosophy**: Clean, professional, information-dense interface that prioritizes clarity and efficiency for B2B research workflows. Minimize visual noise to let multi-response content breathe.

## Color Palette

### Dark Mode (Primary)
- **Background**: 15 8% 8% (deep charcoal)
- **Surface**: 15 8% 12% (elevated cards/panels)
- **Border**: 15 8% 18% (subtle dividers)
- **Primary**: 262 83% 58% (vibrant purple for CTAs and active states)
- **Primary Hover**: 262 83% 52%
- **Text Primary**: 0 0% 98%
- **Text Secondary**: 0 0% 70%
- **Text Tertiary**: 0 0% 50%
- **Success**: 142 71% 45% (for completed responses)
- **Warning**: 38 92% 50% (for active streaming)
- **Error**: 0 84% 60%

### Light Mode (Secondary)
- **Background**: 0 0% 100%
- **Surface**: 0 0% 98%
- **Border**: 0 0% 90%
- **Primary**: 262 83% 58%
- **Text Primary**: 0 0% 10%
- **Text Secondary**: 0 0% 40%

## Typography
**Font Stack**: Inter (via Google Fonts CDN), system-ui fallback

- **Page Title**: 24px, 600 weight, -0.02em tracking
- **Section Headers**: 18px, 600 weight
- **Response Card Title**: 16px, 600 weight
- **Body Text**: 15px, 400 weight, 1.6 line-height
- **Metadata/Secondary**: 13px, 500 weight
- **Code/Monospace**: 14px, JetBrains Mono

## Layout System
**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24 (p-2, m-4, gap-6, etc.)

**Grid Structure**:
- Sidebar: Fixed 280px width on desktop, full-width drawer on mobile
- Main content: max-w-5xl container, px-8 on desktop, px-4 on mobile
- Response cards: Full width within container, stacked vertically with gap-4

**Vertical Rhythm**: py-6 for card interiors, py-8 between major sections

## Component Library

### Navigation & Sidebar
- **Header**: Fixed top bar with logo left, control panel button right, subtle bottom border
- **Sidebar Chat List**: Scroll container with grouped conversations (Today, Yesterday, Last 7 Days), each item 48px height with hover state showing surface color, active conversation highlighted with left border accent (primary color)
- **New Chat Button**: Prominent primary button at sidebar top

### Response Cards
- **Container**: Surface background, rounded-lg (8px), border subtle, p-6 interior spacing
- **Header**: Flex row with display name (16px bold), model badge (small pill), status indicator (streaming animation or checkmark)
- **Content Area**: Prose-friendly markdown rendering, max-w-none
- **Footer**: Metadata row showing tokens (input/output/total), duration, collapsible state toggle
- **Tool Calls Section**: Collapsible accordion showing web search queries and MCP tool executions, muted background, rounded corners, p-4

### Control Panel
- **Overlay**: Modal approach, fixed right sidebar (480px), dark overlay backdrop
- **Configuration List**: Vertical stack with gap-4, each config as bordered card
- **Config Card**: Display name as header, parameters in 2-column grid (Model, Reasoning Effort, Web Search toggle, Top-P slider, Response Mode selector), action buttons (Edit, Delete, Duplicate, Toggle) in footer
- **Locked Default**: Visual indicator (lock icon), duplicate-only action
- **Add New**: Primary button at bottom of list

### Input Area
- **Container**: Sticky bottom, surface background with top border, p-6
- **Text Area**: Auto-expanding (min 48px, max 200px), rounded-lg, border on focus, pr-12 for send button
- **Send Button**: Absolute positioned right-3, primary color, circular, icon-only

### Badges & Status
- **Model Badges**: Small pills with model name, surface background, border, px-3 py-1
- **Streaming Indicator**: Animated gradient pulse on response card header
- **Token Counts**: Monospace font, muted color, separated by slashes

## Animations
**Minimal Approach**: 
- Card entrance: Subtle fade-in (200ms ease-out)
- Streaming indicator: Gentle pulse animation (2s infinite)
- Collapsible sections: Smooth height transitions (300ms ease-in-out)
- No scroll-triggered or parallax effects

## Accessibility
- Maintain WCAG AA contrast ratios in both modes
- All interactive elements min 44px touch target on mobile
- Form inputs with consistent dark mode styling (background: 15 8% 10%, border: 15 8% 20%)
- Focus rings using primary color at 40% opacity

## Images
**No Hero Image**: This is a utility-first application. Launch directly into the interface.

**Avatar/Logo**: Simple wordmark or abstract icon in header, approximately 32px height, primary or white color depending on theme.

## Responsive Behavior
- **Desktop (1024px+)**: Persistent sidebar, multi-column control panel layout
- **Tablet (768px-1023px)**: Collapsible sidebar, single-column control panel
- **Mobile (<768px)**: Full-screen views, sidebar as drawer, floating action button for new chat

## UI Patterns
**Multi-Response Layout**: Vertical stack (never horizontal), each response gets equal visual weight, clear separation via consistent gap-4 spacing.

**Empty States**: Centered content with icon, heading, and suggested actions (e.g., "No conversations yet. Start by creating a new chat.").

**Loading States**: Skeleton loaders for chat history, streaming text cursor for active responses.