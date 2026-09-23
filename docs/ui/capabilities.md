# Current Smoji UI capabilities

Evidence: existing React workbench source at e10929d; v0 reuses this implementation
with public fixture data and isolated storage. This inventory is not a roadmap.

| Surface | Existing actions / states | Source and tests |
|---|---|---|
| Shell and catalog | Pack/custom tabs, 36 categories, select/invert/clear, drawer below 901 px | `features/shell`, `features/packs`; `e2e/responsive-viewports.spec.ts` |
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

Prototype coverage: v0 retains its 348 local samples. v1 reuses the current workbench
with all 35 production packs (5,830 items), plus the approved first pack 大肥鱼
(104 items), for 36 packs / 5,934 items. Existing catalog entries were compared
with the live workbench manifest. v1 uses production CDN originals and export URLs,
isolated storage, and no CI-generated thumbnail index. The production manifest now
matches v1 exactly after resolving CDN URLs; no deployment is implied.

Known limits: historical storage migration is not tested. Browser emulation does not establish
physical device, Safari, assistive-technology or CI readiness. The previously recorded
ImageMagick frame-cloning failure was fixed while enabling numbered WebP assets;
the existing preview regression now covers animated GIF and numbered WebP locally
and through verified downloads.
