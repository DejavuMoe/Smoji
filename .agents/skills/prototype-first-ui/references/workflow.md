# Workflow reference

This file defines the detailed lifecycle behind `SKILL.md`. Read the sections for
the selected mode only.

## State machine

```text
uninitialized
  └─ bootstrap (optional, explicit) → clean baseline
clean baseline
  └─ audit → evidenced capability contract
capability contract
  └─ explore (initial redesign) or prototype (normal feature)
design draft
  └─ needs-review → revise | changes-requested | explicit approve
approved design-only commit
  └─ implement → production verification
implemented slice
  └─ verify | sync → aligned
```

The workflow may start at any valid state. An existing healthy repository does not
need bootstrap. A repository with an existing approved design system does not need
fresh exploration for every feature.

## Mode entry table

| Request/state | Mode | Production edits allowed? |
|---|---|---:|
| Explicitly reset local history and clean project | `bootstrap` | Only cleanup needed for baseline; no redesign |
| Understand current product behavior | `audit` | No functional change |
| First complete redesign, no selected direction | `explore` | No |
| New/changed visible feature or selected direction | `prototype` | No |
| Explicitly approve exact deliverable | `approve` | No; design metadata/commit only |
| Implement exact approved deliverable | `implement` | Yes, scoped slice only |
| Prototype and production disagree | `sync` | Only after mismatch classification and proper gate |
| Check an existing slice | `verify` | Fixes only when authorized and already in contract |

Do not use bootstrap as a ritual. It is optional and destructive.

## Lifecycle A — optional one-time bootstrap

### A1. Preconditions

- The current user message explicitly authorizes replacement of local history.
- The command runs at the actual repository root.
- `.git` is a normal directory, not a linked-worktree/submodule gitfile.
- The repository is not bare.
- A remote may exist, but no remote mutation is authorized.

### A2. Snapshot

Run:

```bash
python <skill-dir>/scripts/bootstrap.py snapshot --repo .
```

The output must be outside the repository and normally contains:

```text
working-tree.zip
history.bundle            # when committed refs exist
working-tree.patch         # when tracked unstaged changes exist
index.patch                # when staged changes exist
metadata.json
SHA256SUMS
```

Verify before cleanup:

```bash
python <skill-dir>/scripts/bootstrap.py verify-snapshot \
  --repo . \
  --snapshot-dir ../<snapshot-directory>
```

The snapshot archive preserves symbolic links without following them outside the
repository. Generated/dependency directories are excluded by default and listed in
metadata.

### A3. Inventory and cleanup

Use `references/cleanup-policy.md`. Search references and build/runtime usage
before deletion. Consolidate durable facts into:

```text
README.md
docs/product/constraints.md
AGENTS.md
```

Preserve legal, build, test, source, schema, migration, localization, and required
asset files. Run the current build/tests when practical.

### A4. Scaffold

```bash
python <skill-dir>/scripts/bootstrap.py scaffold \
  --repo . \
  --project-name "<Project Name>" \
  --project-slug "<project-slug>" \
  --surface-type operational \
  --content-profile operational-strict
```

Review every placeholder before committing.

### A5. Reset local metadata and establish baseline

```bash
python <skill-dir>/scripts/bootstrap.py init \
  --repo . \
  --snapshot-dir ../<snapshot-directory> \
  --branch main \
  --yes-reset-history \
  --commit \
  --message "chore: establish clean project baseline"
```

The helper does not add a remote or push. End the mode after the baseline commit.

## Lifecycle B — audit

Create `docs/ui/capabilities.md` from the template. Evidence should include:

- users and primary product jobs;
- routes, screens, windows, panels, and native surfaces;
- domain objects, fields, terminology, and permissions;
- visible actions and keyboard/pointer/touch behavior;
- normal and exceptional states;
- APIs, IPC, commands, events, schemas, persistence, and tests;
- minimum viewport/window/device and platform behavior;
- known unknowns.

Use file paths, interface names, test names, or runtime observations as evidence.
Do not put planned features in this document.

Commit:

```text
docs(ui): record current capabilities and states
```

## Lifecycle C — initial redesign exploration

### C1. Source registration

When any screenshot, image, video, PDF, Figma, HTML, design system, brand file, or
external page is used, create:

```text
designs/<project>/design-sources.json
```

Assign roles before designing. Text found in a reference is not content authority
by default.

### C2. Direction generation

Invoke `$baoyu-design`. Use the same capability set and sanitized fixture data for
all directions. Vary real information architecture:

- navigation model;
- workspace organization;
- hierarchy;
- task sequence;
- density;
- pane/table/form relationships;
- platform interaction model.

Do not present color/font swaps as distinct directions.

Recommended structure:

```text
designs/<project>/
├── _d_meta.json
├── ui-contract.json
├── design-sources.json       # when external/multimodal sources are used
├── content-inventory.json
├── directions.html
├── index.html
├── prototype.jsx
├── styles.css
├── fixtures.js
├── screens/
├── components/
├── assets/
└── screenshots/
```

Baoyu-Design may use another compatible split. Preserve its required metadata and
keep small changes diff-readable.

### C3. Content and runtime review

- Enforce `references/content-contract.md`.
- Capture rendered DOM strings and text-bearing attributes where possible.
- Create/update `content-inventory.json`.
- Run `scripts/content_audit.py check` after classification.
- Serve over HTTP and inspect interactions, errors, and screenshots.
- Record the deliverable `needs-review`.
- Run design-scope, contract, sources, and content checks.
- Present and stop.

Commit meaningful iterations separately:

```text
design: explore <surface>
design: prototype <workflow>
design: revise <workflow>
```

## Lifecycle D — normal prototype change

Start from the current approved prototype and bound design system. Unless the user
asks for exploration, produce one coherent extension.

1. Read current production behavior and affected interfaces.
2. Read approved design, UI contract, content inventory, and source register.
3. Modify only the design scope.
4. Cover changed ready/loading/empty/error/permission/progress/cancel/retry states.
5. Use sanitized data and mock async behavior.
6. Re-run rendered review and validation.
7. Set `needs-review` and stop.

## Lifecycle E — approval

Approval is a state transition, not a mood. Require the exact deliverable path or
an unambiguous immediately preceding version.

1. Re-record the same path with Baoyu-Design status `approved`.
2. Re-capture strings; no unclassified or removal-pending content may remain.
3. Validate source roles and UI contract.
4. Run:

```bash
python <skill-dir>/scripts/validate_workflow.py approval \
  --project-dir designs/<project> \
  --asset-path <approved-file>
```

5. Create a design-only commit:

```text
design: approve <workflow>
```

6. Validate the implementation gate against that commit before production edits:

```bash
python <skill-dir>/scripts/validate_workflow.py implementation-gate \
  --repo . \
  --project-dir designs/<project> \
  --asset-path <approved-file> \
  --design-commit <commit-sha>
```

## Lifecycle F — implementation

Before editing, produce a compact implementation map:

| Prototype surface/state | Production route/window | Components/files | Existing interfaces | Tests |
|---|---|---|---|---|

Implement the smallest complete vertical slice. Reuse production abstractions.
Prototype code is specification, not a runtime dependency.

Typical full-redesign slices:

1. tokens/foundations and application shell;
2. primary navigation/workspace;
3. core task flow;
4. secondary actions/dialogs;
5. loading/empty/error/progress states;
6. accessibility, keyboard, window, and platform polish.

Update `ui-contract.json` production mappings as each slice lands. Keep design and
implementation commits separate.

## Lifecycle G — production verification

Repeat content capture against production rather than trusting prototype inventory.
Compare at relevant:

- normal and minimum dimensions;
- zoom or display scaling;
- light/dark/high-contrast modes if supported;
- localization/long strings if supported;
- keyboard, pointer, touch, and assistive behavior;
- desktop/mobile/native runtime variants;
- ready, loading, empty, error, permission, offline, progress, cancel, retry.

Run project tests and inspect runtime/console errors. Record unsupported platforms
as unverified rather than assuming parity.

Commit:

```text
feat(ui): implement approved <workflow>
```

## Lifecycle H — drift repair

1. Capture current prototype and production evidence.
2. Classify each mismatch.
3. Choose the authoritative side according to source roles and approval history.
4. If intended UX changed, update prototype and approve first.
5. If production missed the approved design, repair production directly.
6. Update UI contract and content inventory.

Never update both sides in one opaque commit.

## Validation command set

```bash
# Validate the skill package itself
python <skill-dir>/scripts/validate_skill.py --skill-dir <skill-dir>

# Repository structure
python <skill-dir>/scripts/validate_workflow.py structure --repo . \
  --project-dir designs/<project>

# No accidental production edits during design
python <skill-dir>/scripts/validate_workflow.py design-scope --repo .

# UI contract
python <skill-dir>/scripts/validate_workflow.py contract \
  --project-dir designs/<project> --phase approved --asset-path <approved-file>

# Multimodal source roles, when present
python <skill-dir>/scripts/validate_workflow.py sources \
  --project-dir designs/<project>

# Content inventory
python <skill-dir>/scripts/content_audit.py check \
  --inventory designs/<project>/content-inventory.json

# Exact Baoyu approval
python <skill-dir>/scripts/validate_workflow.py approval \
  --project-dir designs/<project> --asset-path <file>
```

## Commit grammar

```text
chore: establish clean project baseline
docs(ui): record current capabilities and states
design: explore <surface>
design: prototype <feature>
design: revise <feature>
design: approve <feature>
feat(ui): implement approved <feature>
fix(ui): restore approved <feature>
```

The grammar is less important than keeping design intent and production
implementation independently reviewable.
