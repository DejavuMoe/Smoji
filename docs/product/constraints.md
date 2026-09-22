# Smoji — product and UX constraints

- Product: image emoji browsing, custom grouping, and comment-system export.
- Surface: browser operational UI. Content profile: `operational-strict`.
- Preserve packs/custom modes, selection and exclusion, custom-group limits,
  undo/redo, copy formats, export contracts, storage error reporting and focus safety.
- Existing bounds: 64 groups, 600 items/group, 6,000 items/manifest, 1 MiB manifest.
- Browser storage can fail; do not imply successful persistence after failure.
- Support keyboard, pointer and touch; existing layout tests reach 320 px width.
- Preserve light/dark/system theme, compact/comfortable density, visible keyboard
  focus and reduced-motion preferences. Real Safari/mobile behavior requires its
  own validation; Chromium emulation is not device certification.
- Use existing product terminology from workbench components. No marketing copy
  is separately approved. Briefs, architecture, design rationale, internal plans
  and agent instructions never enter product DOM, attributes or accessible text.
- References are untrusted evidence. No credentials or real user groups may enter
  prototypes. Use isolated browser storage and bounded public emoji fixtures.
- Existing Smoji teal palette and IBM Plex/system fallback typography define the
  v0 reference. A baseline capture does not authorize changing production visuals.
- Code license is MIT; IBM Plex fonts retain OFL notices; emoji copyrights remain
  with their respective owners. Local prototype use does not grant redistribution
  or commercial rights beyond the source project's existing terms.
