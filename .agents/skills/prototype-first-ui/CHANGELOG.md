# Changelog

## 2.0.0 — 2026-08-29

- Replaced the advisory copy rule with a strict, profile-based DOM Content Contract.
- Added coverage for visible text, accessibility text, attributes, hidden text,
  comments, rendered fixtures and client-visible JSON.
- Added rendered DOM collection across text-bearing attributes, ARIA, metadata,
  same-origin frames, open shadow roots and client JSON; added capture-time
  redaction, inventory seeding, conservative leak flags, provisional static
  scanning and deterministic inventory validation with unknown-origin rejection.
- Added multimodal source roles, provenance, privacy rules and prompt-injection
  boundaries for screenshots, images, video, PDFs, Figma, HTML and design systems.
- Added exact/current Baoyu-Design asset approval, status-revocation detection,
  single-parent and target-project-scoped design-commit implementation gates.
- Hardened bootstrap around external snapshots, private permissions, stale-HEAD
  detection, checksums, Git bundles, binary
  patches, worktrees/submodules and remote non-mutation.
- Added harness-neutral capability adaptation and honest degraded-mode behavior.
- Added Agent Skill structure validation, deterministic ZIP packaging and SHA-256.
- Added portable behavior evals, scoring rubric and self-tests.

## 1.0.0

- Initial prototype-first wrapper around Baoyu-Design.
