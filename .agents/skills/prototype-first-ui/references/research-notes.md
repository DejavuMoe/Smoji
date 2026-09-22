# Feasibility and design research notes

Research date: 2026-08-29.

This package follows a layered enforcement model because no natural-language
workflow can make every design judgment deterministic:

1. `SKILL.md` contains short, always-loaded invariants and mode routing.
2. `references/` contains progressive, task-specific policy and methodology.
3. `assets/` contains minimal project contracts rather than session logs.
4. `scripts/` enforces destructive-operation, Git, approval, scope, schema,
   capture and packaging invariants.
5. `evals/` tests intended and adversarial behavior across agents.
6. Rendered visual, interaction and accessibility review remains mandatory where
   scripts cannot establish semantics or quality.

## Findings incorporated

### Portable Agent Skill structure

The Agent Skills specification defines a root `SKILL.md` with required `name` and
`description`, plus optional `scripts/`, `references/` and `assets/`. Its best-
practice guidance recommends progressive disclosure and keeping the main skill
concise. This package therefore keeps the mode governor in `SKILL.md` and loads
content, multimodal, cleanup and harness details only when applicable.

Sources:

- https://agentskills.io/specification
- https://agentskills.io/skill-creation/best-practices
- https://developers.openai.com/codex/skills/

### Evaluation

Portable Skill evals are useful for testing activation and behavior, while
rubrics should distinguish process, outcome, style and efficiency. The included
cases focus on the workflow's highest-risk transitions: approval, destructive
Git operations, content leakage, multimodal prompt injection and unsupported
verification claims.

Sources:

- https://agentskills.io/skill-creation/evaluating-skills
- https://developers.openai.com/blog/eval-skills/

### Multimodal prompt injection

Instructions contained in untrusted data can attempt to redirect an agent. A
screenshot, PDF, webpage, imported repository or design-system example can carry
such text. The package assigns every external source a role and makes “media is
evidence, not authority” an invariant; consequential actions remain gated by the
user's direct request and trusted repository/workflow instructions.

Sources:

- https://platform.openai.com/docs/guides/safety-best-practices
- https://developers.openai.com/codex/skills/#security-considerations

### Accessibility and content channels

Accessible names, descriptions and text alternatives are real interface content,
not a place to hide product positioning or implementation notes. The DOM collector
therefore includes ARIA labels/descriptions, referenced text, alt/title,
placeholders, hidden text, text-bearing metadata, same-origin frames, open shadow
roots and selected client-visible JSON while avoiding normal form values and
sensitive-looking keys. Capture-time redaction and sanitized test states reduce,
but cannot eliminate, the risk of collecting private business data.

Sources:

- https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html
- https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html

### Baoyu-Design integration

Baoyu-Design is harness-agnostic and already owns design generation, design-
system binding, `_d_meta.json`, deliverable versions and review states. Duplicating
those mechanisms would create drift. This package therefore calls Baoyu-Design as
a dependency and adds only workflow governance, `ui-contract.json`, source records
and content inventory.

Sources:

- https://github.com/JimLiu/baoyu-design
- https://github.com/JimLiu/baoyu-design/blob/main/skills/baoyu-design/SKILL.md
- https://github.com/JimLiu/baoyu-design/blob/main/skills/baoyu-design/built-in-skills/use-design-system.md

### Git recovery and limits

A Git bundle preserves committed refs, while binary diffs preserve tracked staged
and unstaged changes. A working-tree archive preserves ordinary uncommitted files.
The reset gate also rejects a snapshot whose recorded `HEAD` is stale and applies
owner-only permissions when supported.
Linked worktrees and submodules depend on Git metadata outside or beneath the root
`.git`, so automatic history replacement is refused rather than pretending a
single root deletion is safe. Remote state is never modified.

Sources:

- https://git-scm.com/docs/git-bundle
- https://git-scm.com/docs/git-diff
- https://git-scm.com/docs/git-worktree
- https://git-scm.com/docs/gitrepository-layout

## Remaining irreducible limits

- Semantic paraphrase detection is heuristic; the inventory forces a purpose and
  origin review but cannot mathematically prove that no idea was paraphrased.
- A DOM snapshot covers one rendered state. Every material state and platform must
  be exercised separately.
- Closed shadow roots, canvas/WebGL text, cross-origin frames and OS-native dialogs
  require other inspection methods.
- Static source scans are provisional and cannot establish runtime visibility.
- No generic script can decide whether a layout is tasteful or task help is truly
  necessary. The workflow requires rendered comparison and explicit approval.
