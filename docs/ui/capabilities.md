# Current Smoji UI capabilities

Evidence: existing React workbench source at e10929d; v0 reuses this implementation
with public fixture data and isolated storage. This inventory is not a roadmap.

| Surface | Existing actions / states | Source and tests |
|---|---|---|
| Shell and catalog | Pack/custom tabs, 35 categories, select/invert/clear, drawer below 901 px | `features/shell`, `features/packs`; `e2e/responsive-viewports.spec.ts` |
| Gallery | Compact/comfortable, progressive 72-item increments, exclusions, group membership, roving keys | `features/gallery`, `hooks/use-roving-grid.ts`; `e2e/keyboard-workflow.spec.ts` |
| Custom groups | Create, rename, duplicate, split, merge, reorder, delete confirmation, import/export, 50-step undo/redo | `features/custom-groups`, `domain/reducer.ts`; `e2e/workbench-custom-groups.spec.ts` |
| Inspector | Previous/next, three backgrounds, five copy formats, add/remove/exclude, close returns focus | `features/inspector`; `e2e/inspector.spec.ts` |
| Export | Selected count, format, preview, copy, download; empty/over-budget/error disables operations | `features/export`, `export.ts`; `e2e/workbench-export.spec.ts` |
| Loading and failures | Catalog loading/retry, image loading/error/retry in inspector, storage failure banner | `main.tsx`, `EmojiImage.tsx`, `WorkbenchProvider.tsx`; component tests |
| Theme | Light/dark/system, reduced-motion and forced-color rules | `ThemeToggle.tsx`, `styles/globals.css`; `e2e/theme-and-a11y.spec.ts` |

All source paths above are relative to `apps/workbench/src/` except paths beginning
`e2e/`. System interfaces are reducer actions, localStorage and browser
clipboard/download APIs; the workbench has no authenticated backend session.

Content: existing domain terminology and task controls. No separately approved
marketing copy. Draft design copy is classified in the prototype inventory;
`needs-review` is not implementation approval.

Known limits: v0 uses 348 locally stored samples, not the full production catalog;
no historical migration data is present. Browser emulation does not establish
physical device, Safari, assistive-technology or CI readiness. Production's
ImageMagick animation-frame test failure is recorded in the ablation report and
is independent of this prototype.
