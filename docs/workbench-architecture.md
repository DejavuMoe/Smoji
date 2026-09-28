# Smoji Workbench React Architecture & Development Guide

## Overview

`@smoji/workbench` is the React workbench for browsing, organizing, and exporting emoji packs for modern comment systems and document platforms.

The application has been engineered with a clean, decoupled architecture:
1. **Core Zero-Dependency Isolation**: `packages/smoji` remains pure TypeScript without external dependencies, maintaining strict size budgets (< 3KB picker core, < 2KB CSS).
2. **Pure Domain State & Logic**: Isolated in `apps/workbench/src/domain/`, free from React or DOM side effects, fully covered by unit tests.
3. **Robust Local Persistence**: Legacy URL/category migration, validation, and synchronous saving on persisted-state changes to `smoji-workbench:*` and `smoji-theme` localStorage keys.
4. **Accessible Component System**: Unstyled Radix UI primitives (`Dialog`, `AlertDialog`, `DropdownMenu`, `Tooltip`) plus small local primitives (segmented radio groups, icon buttons, sheets) styled by plain CSS with OKLCH design tokens. No utility-CSS framework or component registry.
5. **Progressive Rendering & Responsive UX**: Progressive rendering (72 items per increment; existing DOM is retained, not virtualized) with `content-visibility: auto` tiles; a three-column desktop layout (packs · gallery · export) that becomes a pack strip, drawer and bottom export sheet below 900 px.
6. **Animation-Safe Image Pipeline**: Grids and lists never mount animated originals. `lib/stills.ts` serves CI previews when available, otherwise decodes each original once into a 192 px first-frame bitmap (6 concurrent decodes, 360-entry LRU), and starts work only near the viewport through one shared `IntersectionObserver`. Originals play only on hover/keyboard focus and in the inspector. Every image reveals from a blurred placeholder through the same `unblur` animation (fade only under reduced motion).

---

## Directory Structure

```
apps/workbench/
├── index.html                  # Minimal shell with the pre-mount theme bootstrap
├── package.json                # @smoji/workbench private workspace package
├── vite.config.ts              # Vite 7 + React configuration
└── src/
    ├── main.tsx                # Catalog loading (same origin, then published copy), boot states, styles
    ├── app/
    │   ├── App.tsx             # Layout shell: rail, gallery, export column / mobile bar and sheets, dialogs
    │   ├── Boot.tsx            # Loading and catalog failure screens
    │   ├── ErrorBoundary.tsx   # React error boundary with graceful fallback
    │   ├── WorkbenchContext.tsx# Context interface and hook
    │   ├── WorkbenchProvider.tsx # State, persistence, global shortcuts, memoized selectors, tooltip provider
    │   └── workbench.test.tsx  # Integrated React workflow tests
    ├── domain/                 # Pure actions, reducer (50-step history), selectors, limits, copy formats
    ├── features/
    │   ├── Chrome.tsx          # Brand, desktop rail, mobile header with pack strip, theme and help buttons
    │   ├── PackList.tsx        # Single-tab-stop pack list with separate selection checkboxes
    │   ├── Gallery.tsx         # Header actions, still-frame tiles, hover copy/action tools, roving focus
    │   ├── Kit.tsx             # Export column: mode switch, selected packs or custom groups, export bar
    │   ├── Groups.tsx          # Custom groups, create form, tray, menus, import/backup, confirmations
    │   ├── ExportBar.tsx       # Counts, size meter, format choice, preview and download
    │   ├── Inspector.tsx       # Detail dialog: live original, backgrounds, four copy rows, action, paging
    │   ├── Preview.tsx         # Export preview with format/scope, copy fallback and download
    │   ├── Help.tsx            # Modes, shortcuts, formats and limits
    │   ├── Toasts.tsx          # Notification region
    │   └── feedback/toast.ts   # Toast store
    ├── ui/
    │   ├── Sticker.tsx         # Blur placeholder, still/live image states, error and retry
    │   ├── primitives.tsx      # Logo, Tip, IconButton, Segmented, Kbd
    │   └── overlays.tsx        # Confirm (focuses 取消) and Sheet
    ├── lib/
    │   ├── actions.ts          # Copy formats, clipboard, downloads, byte formatting
    │   ├── fly.ts              # Web Animations fly-to feedback when adding to an export
    │   └── stills.ts           # Still-frame cache, decode queue and viewport gating
    ├── hooks/                  # Media query, reduced motion, roving grid, visual viewport
    ├── persistence/storage.ts  # Storage loading, migration, synchronous persistence
    └── styles/                 # tokens, base, layout, gallery, kit, overlays, fonts (plain CSS)
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
- Warm paper surfaces (`--paper`, `--sheet`), near-black ink (`--ink`) for primary actions, and a single highlighter yellow (`--mark`) for selection and inclusion states; all tokens are OKLCH in `styles/tokens.css` with a matching `[data-theme="dark"]` set.
- IBM Plex Sans for interface text and IBM Plex Mono for counts, IDs and code.
- Reduced-motion and forced-colors rules keep focus rings and state visible without animation.

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
