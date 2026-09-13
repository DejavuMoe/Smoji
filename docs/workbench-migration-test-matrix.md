# Smoji Workbench React Migration Test Matrix

This document maps every legacy test and behavioral contract to its replacement across Pure Unit, React Component, and Playwright E2E tiers.

## Core Migration Principles
1. **Behavior Preservation**: Legacy behavior contracts (selection, partial invert, export formats, storage compatibility, undo/redo, touch/keyboard interactions, focus restoration) must be strictly maintained.
2. **No Regression**: Old tests are retained and mapped to behaviorally equivalent tests in Vitest and Playwright.
3. **Radix Primitive Replacement**: Hand-rolled `focus-trap` and `select-control` are superseded by Radix Dialog, Sheet, AlertDialog, and Select, verified through real keyboard and overlay E2E tests.

---

## Detailed Test Mapping Matrix

| Legacy Test Suite | Legacy Behavior Tested | Replacement Test / Target Suite | Verification Tier | Status |
| :--- | :--- | :--- | :--- | :--- |
| `ux-regression.test.ts` | **Pack Invert Semantics**: 0 selected → 全选; 1+ selected → 反选 (Set complement); partial invert `[A, C] -> [B, D]` | `domain/reducer.test.ts`, `features/packs/pack-selection.test.tsx`, `e2e/workbench-packs.spec.ts` | Unit + RTL + Playwright (Chromium, Firefox, WebKit) | Verified & Active |
| `ux-regression.test.ts` | **Destructive Focus**: Delete group dialog sets initial focus on "取消" (Cancel), NOT "确认/删除" (Delete) | `features/custom-groups/custom-groups.test.tsx`, `e2e/confirm-dialog.spec.ts` | RTL + Playwright (Chromium, Firefox, WebKit) | Verified & Active |
| `ux-regression.test.ts` | **Export Scope & Format Sync**: Dock select syncs with Code Modal preview tab; Ctrl+Shift+P shortcut | `features/export/export-dock.test.tsx`, `e2e/workbench-export.spec.ts` | RTL + Playwright (Chromium, Firefox, WebKit) | Verified & Active |
| `ux-regression.test.ts` | **Clipboard Fallback**: When `navigator.clipboard` is unavailable, focus input, select all text, show "手动复制" | `features/inspector/inspector.test.tsx`, `e2e/inspector.spec.ts` | RTL + Playwright (Chromium, Firefox, WebKit) | Verified & Active |
| `ux-regression.test.ts` | **Native HTML5 DnD**: Reorder groups, reorder items within tray, drop items across groups | `features/gallery/EmojiCard.tsx`, `features/custom-groups/CustomGroupRow.tsx`, `e2e/workbench-custom-groups.spec.ts` | Component + Playwright (Chromium, Firefox, WebKit) | Verified & Active |
| `audit-regression.test.ts` | **Undo / Redo Multi-Level**: 50-step transaction history for add, delete, rename, reorder, split, merge, and import | `domain/reducer.test.ts`, `e2e/workbench-custom-groups.spec.ts` | Unit + Playwright (Chromium, Firefox, WebKit) | Verified & Active |
| `audit-regression.test.ts` | **Storage Robustness**: Corrupt JSON, unavailable storage, storage quota errors, bundle validation | `apps/workbench/src/storage.test.ts`, `persistence/storage.ts` | Pure Unit | Verified & Active |
| `copy-format.test.ts` | **Copy Format Generators & Shortcuts**: Markdown, URL, Hugo (escaped), HTML, BBCode formats and '1'-'5' keys | `domain/copy-format.ts`, `features/inspector/inspector.test.tsx`, `e2e/inspector.spec.ts` | Unit + RTL + Playwright (Chromium, Firefox, WebKit) | Verified & Active |
| `responsive-ui.test.ts` | **Mobile Drawer & Safe Area**: Drawer inert when closed, focus trap when open, visual viewport CSS vars | `hooks/use-visual-viewport.ts`, `hooks/use-dock-offset.ts`, `e2e/responsive-viewports.spec.ts`, `e2e/theme-and-a11y.spec.ts` | Unit + Playwright (Chromium, Firefox, WebKit) | Verified & Active |
| `boot-failure.test.ts` | **Graceful Boot & Asset Fallback**: Missing aliases chunk still renders custom groups safely | `apps/workbench/src/boot-failure.test.ts`, `apps/workbench/src/asset-paths.ts` | Pure Unit | Verified & Active |
| `export.test.ts` | **Pure Domain Export Logic**: Smoji, Artalk, Twikoo, OwO, Markdown generators and security validation | `apps/workbench/src/export.test.ts`, `apps/workbench/src/export.ts` | Pure Unit | Verified & Active |
| `storage.test.ts` | **Schema Migration & Limits**: Max 64 packs, max 600 items/group, max 6000 total items, storage keys | `apps/workbench/src/storage.test.ts`, `apps/workbench/src/persistence/storage.ts` | Pure Unit | Verified & Active |
| `focus-trap.test.ts` | **Modal Focus Trap**: Tab cycle, initial focus | Radix Dialog, AlertDialog, Sheet primitives verified in `e2e/confirm-dialog.spec.ts`, `e2e/inspector.spec.ts`, `e2e/workbench-export.spec.ts` | Playwright E2E | Superseded by Radix & Verified |
| `select-control.test.ts` | **Custom Select Control**: Keyboard / click navigation | Radix Select primitive verified in `e2e/workbench-export.spec.ts` | Playwright E2E | Superseded by Radix & Verified |

---

## Immutable Contracts Checklist
- [x] "全选 → 反选" dynamic toggle and partial invert (Set complement: 0 selected → 全选; 1+ selected → 反选; `[A, C] -> [B, D]`)
- [x] Zero Smoji Core contamination (`packages/smoji` remains pure TS, zero dependency, within size budget)
- [x] Storage compatibility with `smoji-theme` and `smoji-workbench:*`
- [x] Destructive actions focus Cancel by default with keyboard Enter safety
- [x] Native HTML5 Drag and Drop without external libraries
- [x] Visual Viewport and Dock dynamic height offset (`--viewport-height`, `--keyboard-inset`, `--selection-dock-offset`)
- [x] 50-step transaction-based Undo/Redo (`⌘/Ctrl+Z`, `⌘/Ctrl+Shift+Z`)
- [x] Desktop (1440, 1280, 1100), Compact Desktop (901-1099), Tablet (601-900), Mobile (<=600) responsiveness
- [x] Real Browser & Device E2E coverage across Chromium, Firefox, WebKit, Tablet, Mobile Chrome, and Mobile Safari (150/150 passed)
