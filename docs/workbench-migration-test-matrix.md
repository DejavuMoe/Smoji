# Smoji Workbench React Migration Test Matrix

This document maps every legacy test and behavioral contract to its replacement across Pure Unit, React Component, and Playwright E2E tiers.

## Core Migration Principles
1. **Behavior Preservation**: Legacy behavior contracts (selection, partial invert, export formats, storage compatibility, undo/redo, touch/keyboard interactions, focus restoration) must be strictly maintained.
2. **No Regression**: Old tests are retained or directly replaced by behaviorally equivalent tests in Vitest and Playwright.
3. **Radix Primitive Replacement**: Hand-rolled `focus-trap` and `select-control` are mapped directly to Radix Dialog, Sheet, AlertDialog, and Select, verified through real keyboard and overlay E2E tests.

---

## Detailed Test Mapping Matrix

| Legacy Test Suite | Legacy Behavior Tested | Replacement Test / Target Suite | Verification Tier | Status |
| :--- | :--- | :--- | :--- | :--- |
| `ux-regression.test.ts` | **Pack Invert Semantics**: 0 selected → 全选; 1+ selected → 反选 (Set complement); partial invert `[A, C] -> [B, D]` | `domain/reducer.test.ts`, `features/packs/pack-selection.test.tsx`, `e2e/workbench-packs.spec.ts` | Unit + RTL + Playwright | Frozen in legacy & mapped |
| `ux-regression.test.ts` | **Destructive Focus**: Delete group dialog sets initial focus on "取消" (Cancel), NOT "确认/删除" (Delete) | `features/custom-groups/delete-alert-dialog.test.tsx`, `e2e/confirm-dialog.spec.ts` | RTL + Playwright | Frozen in legacy & mapped |
| `ux-regression.test.ts` | **Export Scope & Format Sync**: Dock select syncs with Code Modal preview tab; Ctrl+Shift+P shortcut | `features/export/export-dock.test.tsx`, `features/export/code-dialog.test.tsx`, `e2e/workbench-export.spec.ts` | RTL + Playwright | Frozen in legacy & mapped |
| `ux-regression.test.ts` | **Clipboard Fallback**: When `navigator.clipboard` is unavailable, focus input, select all text, show "手动复制" | `features/inspector/inspector.test.tsx`, `e2e/inspector.spec.ts` | RTL + Playwright | Frozen in legacy & mapped |
| `ux-regression.test.ts` | **Native HTML5 DnD**: Reorder groups, reorder items within tray, drop items across groups | `features/custom-groups/drag-drop.test.tsx`, `e2e/drag-drop.spec.ts` | Unit + Playwright | Frozen in legacy & mapped |
| `audit-regression.test.ts` | **Undo / Redo Multi-Level**: 50-step transaction history for add, delete, rename, reorder, split, merge, and import | `domain/history.test.ts`, `domain/reducer.test.ts`, `e2e/workbench-history.spec.ts` | Unit + Playwright | Frozen in legacy & mapped |
| `audit-regression.test.ts` | **Storage Robustness**: Corrupt JSON, unavailable storage, storage quota errors, bundle validation | `persistence/storage.test.ts`, `persistence/migrations.test.ts` | Unit | Frozen in legacy & mapped |
| `copy-format.test.ts` | **Copy Format Generators & Shortcuts**: Markdown, URL, Hugo, HTML, BBCode formats and '1'-'5' keys | `domain/copy-format.test.ts`, `features/inspector/copy-tabs.test.tsx`, `e2e/inspector.spec.ts` | Unit + RTL + Playwright | Frozen in legacy & mapped |
| `responsive-ui.test.ts` | **Mobile Drawer & Safe Area**: Drawer inert when closed, focus trap when open, visual viewport CSS vars | `hooks/use-visual-viewport.test.ts`, `hooks/use-dock-offset.test.ts`, `e2e/mobile-responsive.spec.ts` | Unit + Playwright | Frozen in legacy & mapped |
| `boot-failure.test.ts` | **Graceful Boot & Asset Fallback**: Missing aliases chunk still renders custom groups safely | `domain/boot.test.ts`, `e2e/workbench-boot.spec.ts` | Unit + Playwright | Frozen in legacy & mapped |
| `export.test.ts` | **Pure Domain Export Logic**: Smoji, Artalk, Twikoo, OwO, Markdown generators and security validation | `domain/export.test.ts` | Pure Unit | Frozen in legacy & mapped |
| `storage.test.ts` | **Schema Migration & Limits**: Max 64 packs, max 600 items/group, max 6000 total items, storage keys | `persistence/storage.test.ts` | Pure Unit | Frozen in legacy & mapped |
| `focus-trap.test.ts` | **Modal Focus Trap**: Tab cycle, initial focus | Radix Dialog / AlertDialog / Sheet primitives tested in `e2e/overlays.spec.ts` | Playwright E2E | Superseded by Radix |
| `select-control.test.ts` | **Custom Select Control**: Keyboard / click navigation | Radix Select primitive tested in `e2e/select.spec.ts` | Playwright E2E | Superseded by Radix |

---

## Immutable Contracts Checklist
- [x] "全选 → 反选" dynamic toggle and partial invert (Set complement)
- [x] Zero Smoji Core contamination (`packages/smoji` remains pure TS, zero dependency)
- [x] Storage compatibility with `smoji-theme` and `smoji-workbench:*`
- [x] Destructive actions focus Cancel by default
- [x] Native HTML5 Drag and Drop without external libraries
- [x] Visual Viewport and Dock dynamic height offset
- [x] 50-step transaction-based Undo/Redo
- [x] Desktop (1440, 1280, 1100), Compact Desktop (901-1099), Tablet (601-900), Mobile (<=600) responsiveness
