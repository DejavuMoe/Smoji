# Current Smoji UI capabilities

Evidence: the React workbench after implementing the approved v2 redesign (the v2 design
commit is 670311f). This inventory is not a roadmap.

| Surface | Existing actions / states | Source and tests |
|---|---|---|
| Shell and catalog | 36 packs in a single-tab-stop list with separate checkboxes, select/invert/clear; pack strip, drawer and bottom export sheet below 900 px | `features/Chrome.tsx`, `features/PackList.tsx`, `app/App.tsx`; `e2e/workbench-packs.spec.ts`, `e2e/responsive-viewports.spec.ts` |
| Gallery | Still-frame tiles (originals play on hover/focus only), viewport-gated loading with blur reveal, compact/comfortable, progressive 72-item increments, hover copy, exclusions, group membership, drag to group, roving keys | `features/Gallery.tsx`, `ui/Sticker.tsx`, `lib/stills.ts`, `hooks/use-roving-grid.ts`; `e2e/keyboard-workflow.spec.ts`, `e2e/theme-and-a11y.spec.ts` |
| Custom groups | Create, rename, duplicate, split, merge, reorder, tray reorder/move/remove, delete and clear confirmations, import/backup, notes, 50-step undo/redo | `features/Groups.tsx`, `domain/reducer.ts`; `e2e/workbench-custom-groups.spec.ts`, `e2e/confirm-dialog.spec.ts` |
| Inspector | Live original with loading/error/retry, previous/next and swipe, three backgrounds, four copy rows (Markdown, URL, HTML, BBCode) with manual-copy fallback, select/exclude/add/remove action, target group, close returns focus | `features/Inspector.tsx`; `e2e/inspector.spec.ts` |
| Export | Selected packs with kept counts, count/size meter, five formats, preview with scope, copy, download; empty/over-budget/error disables operations | `features/Kit.tsx`, `features/ExportBar.tsx`, `features/Preview.tsx`, `export.ts`; `e2e/workbench-export.spec.ts` |
| Loading and failures | Catalog loading/retry and published-copy fallback, storage failure banner, failed migration keeps saved groups | `main.tsx`, `app/Boot.tsx`, `WorkbenchProvider.tsx`; `e2e/audit-regressions.spec.ts` |
| Theme | Light/dark/system, reduced-motion and forced-color rules, tooltips instead of native titles | `features/Chrome.tsx`, `styles/tokens.css`; `e2e/theme-and-a11y.spec.ts` |

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

v2 (`implemented`) redesigns only the presentation layer over the same reducer, persistence and
export modules and the same 36 packs / CDN URLs. It adds hover copy, all-format copy rows in the
inspector, a single-tab-stop pack list and still-frame grids (animation on hover/focus and in the
inspector). Search from earlier drafts was removed before implementation. Production evidence is
in `designs/smoji/evidence/production/` (`verify-v2.mjs --production`).

Known limits: historical storage migration is not tested. Browser emulation does not establish
physical device, Safari, assistive-technology or CI readiness. The previously recorded
ImageMagick frame-cloning failure was fixed while enabling numbered WebP assets;
the existing preview regression now covers animated GIF and numbered WebP locally
and through verified downloads.
