# Smoji Workbench React Architecture & Development Guide

## Overview

`@smoji/workbench` is the React workbench for browsing, organizing, and exporting emoji packs for modern comment systems and document platforms.

The application has been engineered with a clean, decoupled architecture:
1. **Core Zero-Dependency Isolation**: `packages/smoji` remains pure TypeScript without external dependencies, maintaining strict size budgets (< 3KB picker core, < 2KB CSS).
2. **Pure Domain State & Logic**: Isolated in `apps/workbench/src/domain/`, free from React or DOM side effects, fully covered by unit tests.
3. **Robust Local Persistence**: Legacy URL/category migration, validation, and synchronous saving on persisted-state changes to `smoji-workbench:*` and `smoji-theme` localStorage keys.
4. **Accessible Component System**: Built on Tailwind CSS v4 and Radix UI primitives (`dialog`, `sheet`, `alert-dialog`, `dropdown-menu`, `tabs`, `progress`).
5. **Progressive Rendering & Responsive UX**: Progressive rendering (72 items per increment; existing DOM is retained, not virtualized), CSS container/media queries across 4 viewport tiers, visual viewport and virtual keyboard offset tracking.

---

## Directory Structure

```
apps/workbench/
├── index.html                  # Shell HTML with theme bootstrap and noscript fallback
├── package.json                # @smoji/workbench private workspace package
├── vite.config.ts              # Vite 7 + Tailwind 4 + React configuration
├── components.json             # Shadcn Radix-Nova component registry configuration
└── src/
    ├── app/
    │   ├── App.tsx             # Main layout shell (Header, Sidebar, MobileNav, Gallery, ExportDock)
    │   ├── ErrorBoundary.tsx   # React error boundary with graceful fallback
    │   ├── WorkbenchContext.tsx# Context interface and hook
    │   ├── WorkbenchProvider.tsx # Provider with state, persistence, shortcuts, memoized selectors
    │   └── workbench.test.tsx  # Full integrated React workflow test
    ├── components/ui/          # Radix primitive components styled with Tailwind 4
    ├── domain/
    │   ├── actions.ts          # Discriminated union of domain actions
    │   ├── copy-format.ts      # Markdown, URL, Hugo, HTML, BBCode generators with quote escaping
    │   ├── limits.ts           # System invariants (64 packs, 600 items/pack, 6000 items, 50 history)
    │   ├── reducer.ts          # Pure reducer with 50-step undo/redo transaction stack
    │   ├── reducer.test.ts     # Domain reducer unit tests (dynamic invert, undo/redo, boundaries)
    │   ├── selectors.ts        # Memoized pure selectors
    │   └── state.ts            # Immutable state types and initial state
    ├── features/
    │   ├── custom-groups/      # Custom packs, reordering, deletion, tray, item drag-drop
    │   ├── export/             # Bottom floating status dock, code modal preview, format export
    │   ├── feedback/           # Accessible Sonner toast notifications
    │   ├── gallery/            # Emoji grid, memoized card, comfortable/compact density, empty states
    │   ├── help/               # Syntax guide and format documentation dialog
    │   ├── inspector/          # Detail dialog, background preview toggle, 1-5 shortcuts, clipboard fallback
    │   ├── packs/              # Pack list, pack row, dynamic selection, item exclusions
    │   └── shell/              # Sticky header, brand, theme toggle, desktop sidebar, mobile nav sheet
    ├── hooks/
    │   ├── use-dock-offset.ts     # Dynamic dock height measurement via ResizeObserver
    │   ├── use-media-query.ts     # Window matchMedia hook
    │   ├── use-reduced-motion.ts  # Prefers-reduced-motion detection
    │   ├── use-roving-grid.ts     # 2D arrow roving navigation for emoji cards
    │   └── use-visual-viewport.ts # Tracks visual viewport height, top offset, keyboard inset
    ├── persistence/
    │   └── storage.ts          # Storage loading, migration, synchronous persistence
    └── styles/
        └── globals.css         # Tailwind v4 theme, Smoji neutral + teal design tokens
```

---

## Architectural Invariants & Behavioral Contracts

### 1. Dynamic "全选 → 反选" (Select All -> Invert Selection)
The primary pack selection button changes label and behavior dynamically based on whether any catalog pack is currently selected:
- **0 Selected**: Label is **「全选」**. Clicking selects all packs in the catalog.
- **1+ Selected**: Label is **「反选」**. Clicking computes the **Set complement** against catalog packs:
  $$\text{Selected}' = \text{Catalog} \setminus \text{Selected}$$
  For example, given packs `[A, B, C, D]` with `[A, C]` selected, clicking 「反选」 yields `[B, D]`.
- Partial invert semantics are strictly preserved in `domain/reducer.ts` and verified in unit tests and integration tests.

### 2. Destructive Confirmation Focus Safety
When presenting confirmation modals for destructive operations (e.g. deleting a custom group or clearing all groups):
- Initial auto-focus is strictly placed on **「取消」** (Cancel), never on the destructive action.
- Built using Radix `AlertDialog` with `Cancel` as the default focused element.

### 3. Clipboard Fallback
When `navigator.clipboard` or `writeText` is rejected or unavailable (e.g. non-HTTPS iframe):
- The copy input automatically focuses and selects all text.
- A manual copy prompt (`Ctrl+C / ⌘+C 手动复制`) is displayed to ensure zero user frustration.

### 4. 50-Step Transactional History (Undo / Redo)
All modifications to custom groups (creation, rename, deletion, reordering, adding items, removing items, tray reordering) push atomic snapshot transactions onto an undo stack capped at 50 steps:
- `⌘+Z` / `Ctrl+Z`: Undo last transaction.
- `⌘+Shift+Z` / `Ctrl+Y`: Redo last transaction.
- Global keyboard listener excludes text inputs and editable fields to preserve native editing.

### 5. Smoji Visual Tokens & Palette
- Light Theme Primary: Smoji Teal (`#0f766e`, OKLCH `oklch(0.48 0.11 185)`)
- Dark Theme Primary: Smoji Mint/Teal (`#68d8bf`, OKLCH `oklch(0.79 0.12 185)`)
- Calm neutral backgrounds, no floating glowing gradients, no unnecessary card clutter.

---

## Build, Test, and Verification Gate

```bash
# Typecheck
pnpm typecheck

# Unit & Component Tests
pnpm test

# Production Build
pnpm build

# Asset Size Verification (<3KB picker core, <2KB CSS)
pnpm check:size

# Full Gate Verification
pnpm check

# Site Output & Release Pipeline Verification
node --experimental-strip-types scripts/verify-site-output.mjs apps/workbench/dist
node scripts/test-publish-site.mjs
```
