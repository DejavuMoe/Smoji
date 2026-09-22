# Release validation report

## Follow-up verification — 2026-09-22

The project-local dependency update was checked on Windows (Python 3.14.7,
Git 2.55.0.windows.5, Node.js 24.21.0). These results supersede the older release
record below only for the checks explicitly listed here.

| Check | Result |
|---|---|
| Skill Creator `quick_validate.py` | Passed with isolated PyYAML and Python UTF-8 mode |
| `python -B scripts/validate_skill.py --skill-dir .` | Passed, zero warnings |
| `python -B tests/run_all.py --report <temporary-report-path>` | All five groups passed on Windows |
| Linux package validation and `content-audit` case | Passed through `linux-task.ps1 -Mode build` |
| `required-skills-stay-project-local` | Passed in an independent agent run with a simulated installer |
| `project-dependency-unavailable` | Passed in a separate independent agent run with a simulated installer |

The quick validator was run with:

```powershell
uv --cache-dir "$env:TEMP\prototype-first-ui-uv-cache" run --no-project --with pyyaml python -X utf8 -B C:\Users\ice\.codex\skills\.system\skill-creator\scripts\quick_validate.py .
```

Initial failures and fixes:

- The quick validator first lacked PyYAML, then used the Windows GBK default
  encoding, then rejected the existing top-level `compatibility` field. Its
  dependency now runs in a temporary isolated environment, UTF-8 is explicit,
  and the same runtime requirements are preserved in the skill body.
- The Windows bootstrap test exposed read-only Git objects blocking authorized
  metadata removal. The reset now retries only read-only regular-file deletion
  failures on Windows, within the verified Git directory. Other errors still
  propagate. The existing end-to-end test now includes explicit read-only
  metadata and passes all authorization, snapshot, submodule, and worktree gates.
- The report writer no longer repeats historical claims about Chromium or an
  unavailable external validator as though they were measured in every run.
- The WSL runner required sandbox escalation. Its hashed mirror directory name
  failed the skill-name check, so Linux validation used a temporary copy named
  `prototype-first-ui` inside Linux. No source edits or Git mutations ran in WSL.

Behavior evaluation used two isolated Windows fixture repositories. Evaluating
agents received the task and skill, without expected outputs. In the available
case, the agent installed and loaded both Baoyu-Design and a transitive helper
inside the project despite an upstream global-install example. In the unavailable
case, the agent wrote an evidenced static capability audit and stopped before
design generation. Installer logs, installed files, unchanged application/global
fixtures, and the audit artifact were inspected afterward. An unsupported help
probe in the installer fixture was not counted as an installation.

Limits: these two runs test dependency handling with simulated upstream files,
not an actual Baoyu-Design download or visual design generation. The other 21
behavior scenarios were schema-validated but not independently replayed in this
follow-up. Browser/native/accessibility integration and cross-model pass rates
are not claimed. Linux execution covered package validation and content auditing;
Git-mutating self-tests ran only with Windows Git in temporary repositories.

## Historical release record — 2026-08-29

- Package: `prototype-first-ui`
- Version: `2.0.0`
- Validation date: 2026-08-29
- Release result: **passed with documented integration limits**

This report records checks actually run against the release candidate. It does
not treat the presence of a script, an eval prompt, or a browser binary as proof
that the corresponding behavior was exercised.

## Validation environment

| Component | Version/result |
|---|---|
| Python | 3.13.5; package sources also parsed against the declared Python 3.9 grammar |
| Git | 2.47.3 |
| Node.js | 22.16.0 |
| Agent Skills reference validator | Not installed; the included dependency-free validator was used |
| Browser integration | Chromium binary present, but reliable headless startup was unavailable in this container |

## Package validation

The following command completed with zero warnings:

```bash
PYTHONDONTWRITEBYTECODE=1 \
python scripts/validate_skill.py --skill-dir .
```

It checked:

- root `SKILL.md` frontmatter, required fields, name and package layout;
- progressive-reference and asset links;
- all JSON files and the behavior-eval schema;
- Python syntax against the Python 3.9 grammar declared by the package;
- JavaScript syntax with Node.js;
- forbidden cache/build artifacts and unsafe links;
- ZIP root layout, path traversal, duplicate paths, CRC integrity and content;
- deterministic packaging and SHA-256 sidecar generation.

Observed release-candidate result before final packaging:

```text
SKILL.md: 307 lines, approximately 3,891 dependency-free estimated tokens
Package: 33 files, 296,470 bytes uncompressed
Validation passed (0 warnings)
```

The final numbers can change slightly when this report is embedded; the final ZIP
is validated again after packaging.

## Deterministic self-tests

The isolated-process runner was executed with:

```bash
PYTHONDONTWRITEBYTECODE=1 \
python tests/run_all.py --report ../prototype-first-ui-validation.json
```

| Test group | Result | What passed |
|---|---|---|
| Content audit | Passed | Rendered-capture inventory grouping, conservative leak flags, strict rejection, unknown-origin rejection and provisional static fallback |
| Workflow gates | Passed | Structure, exact/current asset approval, approval revocation, target-scoped design commit, ancestry, drift, source-role and dirty-design gates |
| Package validation | Passed | Skill structure, Python/JavaScript syntax, ZIP CRC/root layout, cache exclusion and deterministic packaging |
| JavaScript syntax | Passed | DOM collector parses under Node.js; this is not presented as live-browser proof |
| Bootstrap safety | Passed | Private recovery permissions, remote redaction, archive completeness, checksums, tamper/stale-HEAD rejection, explicit authorization, local reset, submodule refusal and linked-worktree refusal |

All five deterministic groups passed. The machine-readable report shipped beside
the release ZIP contains durations and exact environment values.

## Behavior evaluation suite

`evals/evals.json` contains **21 portable behavior and adversarial scenarios**.
The rubric checks activation, mode selection, file scope, approval gates, Git
safety, content leakage, multimodal prompt injection, source authority, secret
sanitization, unsupported-verification honesty and prototype/production drift.

These scenarios are provided for evaluation on Codex, Claude Code, Cursor, or any
other compatible file-capable agent. They were schema-validated as part of this
release, but were **not executed against every external model or harness** in this
container. Cross-agent pass rates therefore are not claimed.

## Feasibility findings reflected in the package

### Strict DOM Content Contract

A deterministic collector and inventory checker can verify that every captured
string has a declared channel, purpose, origin, decision and evidence. It can
reject unclassified, prohibited-origin, unapproved or suspicious strings. It
cannot mathematically determine whether all paraphrases of a design rationale were
removed or whether help text is genuinely necessary. The workflow therefore
requires rendered review and explicit approval in addition to scripts.

### Multimodal Agent use

The workflow is portable when an agent can read files and map abstract actions to
its own tools. Images, screenshots, video frames, PDFs, Figma notes, webpages,
imported code and design-system examples are assigned source roles before use and
are treated as untrusted evidence, never executable instructions. When a modality
or preview tool is inaccessible, the skill requires a precise `unverified` result
rather than guessed content or fabricated inspection.

### Git history replacement

Local-history reset is feasible only under narrow preconditions. The helper
requires current-request authorization and a verified external snapshot, rejects
linked worktrees, submodules, bare/nested repositories, stale snapshots and
changed `HEAD`, and contains no remote write or force-push path. Recovery material
may contain private local files and must be kept private.

## Known limits

- The DOM collector was syntax-checked but did not receive a reliable live
  Chromium integration run in this container. Real projects must inject it into
  each material rendered state and inspect the accessibility tree separately when
  available.
- Closed shadow roots, canvas/WebGL text, cross-origin frames, browser extension
  privileged UI, and OS-native dialogs require modality- or platform-specific
  inspection.
- A DOM capture represents one state and viewport. Loading, empty, error,
  permission, progress, cancellation, retry, offline, responsive and platform
  states must be exercised separately.
- Static source scanning is intentionally provisional and cannot earn final
  approval.
- Visual hierarchy, aesthetic quality, business truthfulness and whether a phrase
  is necessary remain semantic review tasks.
- No `skills-ref` executable was available. The package validator follows the
  public Agent Skills layout and constraints, but this report does not claim an
  external certification.

## Release decision

The package is suitable for controlled use as a general prototype-first workflow
Skill, including multimodal design inputs, provided that projects keep the human
approval gate and perform real rendered/native verification. The deterministic
checks cover the dangerous transitions; they deliberately do not pretend to
replace product judgment or visual review.
