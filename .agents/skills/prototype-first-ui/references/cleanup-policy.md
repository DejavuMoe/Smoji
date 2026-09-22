# Repository cleanup policy

Use this policy only in explicitly authorized `bootstrap` mode. The goal is a
small, functional, understandable baseline—not indiscriminate deletion or a new
architecture.

## Safety classification before cleanup

Classify the repository before changing it:

- actual repository root;
- normal `.git` directory, linked worktree/submodule gitfile, bare repository, or
  nested repository;
- current branch, HEAD, tags, remotes, submodules, worktrees, and dirty state;
- build/runtime/package manager and generated-code workflow;
- legal/licensing requirements;
- deployment/CI release dependencies;
- secret-bearing local files that must not enter a new commit.

The bootstrap helper must refuse history reset for a `.git` file, bare repository,
or invocation below the real root. Handle those cases manually and explicitly.

## Always preserve

- application/library source and native project files;
- tests and fixtures required by tests;
- migrations, schemas, generated API contracts required to build, and localization;
- package manifests, lockfiles, compiler/bundler/native configuration, CI actually
  used by the project, deployment/runtime configuration, and safe environment
  examples;
- icons, fonts, images, sample data, and other assets consumed by the application;
- license, copyright, notice, security, authorship, and third-party attribution;
- current user-facing documentation required legally or operationally;
- data or configuration whose purpose is uncertain until investigated.

Do not remove security policy, code owners, release signing configuration, or
supply-chain files merely to make the root look clean.

## Protect secrets and local-only state

Before the new baseline commit:

- inspect `.env*`, credentials, tokens, certificates, signing keys, local database
  files, IDE state, crash dumps, and platform key stores;
- preserve necessary examples but never commit live secrets;
- update `.gitignore` only after understanding current generation/runtime behavior;
- do not upload the external snapshot or include it inside the repository;
- remember that the snapshot intentionally may contain local sensitive data and
  must be stored accordingly.

## Consolidate durable facts

Merge still-true information, then remove duplicates:

- repeated `PLAN*`, `ROADMAP*`, `TODO*`, `NOTES*`, `STATUS*`, and session logs;
- multiple architecture summaries that conflict with code;
- large duplicated `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, prompt files, or
  agent transcripts;
- old redesign proposals and abandoned design-system notes;
- duplicated setup instructions across READMEs;
- implementation diaries already represented by code, tests, and the external
  history bundle.

Place:

- run/build/test commands in `README.md` or short `AGENTS.md`;
- durable product/UX/content/privacy constraints in
  `docs/product/constraints.md`;
- current evidenced product behavior in `docs/ui/capabilities.md` after bootstrap;
- approved design artifacts under `designs/` after audit begins.

## Usually remove from the new baseline

Only after confirming they are generated, stale, duplicated, or unused:

- build output and caches such as `dist`, `build`, `target`, `.next`, `.nuxt`,
  coverage, language caches, and temporary exports;
- dependency directories such as `node_modules` or virtual environments when
  reproducible from manifests/lockfiles;
- agent transcripts, raw prompts, temporary plans, generated summaries, benchmark
  scratch files, and one-off screenshots;
- obsolete prototypes, old design exports, and duplicated unreferenced assets;
- historical changelogs whose sole purpose is the intentionally discarded local
  history, unless legally or operationally useful;
- dead scripts/configuration proven unused by source, build, CI, packaging, tests,
  deployment, or release paths.

## Never infer deletion from a filename

Before deleting an unfamiliar path:

1. search source, build, runtime, CI, packaging, deployment, tests, and docs;
2. inspect dynamic loaders, glob patterns, and framework conventions;
3. classify it as keep, consolidate, generated/remove, or unknown;
4. preserve it when uncertain.

An external snapshot is recovery, not evidence that deletion is safe.

## Directory reorganization

- Do not move framework-required directories for aesthetic neatness.
- Avoid broad architecture refactors during bootstrap.
- Preserve import paths, packaging rules, native resources, migrations, and release
  automation.
- Prefer a quiet root, but functional conventions win.

Typical baseline:

```text
AGENTS.md
README.md
LICENSE / NOTICE / SECURITY (when present)
.gitignore
package/build/runtime manifests and lockfiles
source directories
native/platform directories
tests
docs/
```

Create `designs/` when design work begins rather than filling the clean baseline
with speculative artifacts.

## Pre-reset checklist

Before deleting `.git`, verify:

- external snapshot path exists outside the repository;
- `verify-snapshot` passes checksums and repository identity;
- history bundle exists when committed refs existed;
- dirty/staged/untracked files are represented in the archive/patches;
- build/tests were run or the inability was recorded;
- keep/move/remove summary was shown;
- no live secrets will enter the baseline commit;
- branch name and commit message are intentional;
- no remote operation is part of this mode.
