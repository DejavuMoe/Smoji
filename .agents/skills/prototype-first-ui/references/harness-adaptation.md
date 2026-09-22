# Harness adaptation

This skill is written for any Agent Skills-compatible, file-capable AI agent. Do
not invent unavailable tools or claim capabilities based on another product.

## Minimum capability levels

### Level 1 — repository workflow

Required for bootstrap, audit, and implementation:

- read/search/write files;
- run local shell commands;
- use Git;
- inspect command output.

If these are missing, the full workflow is not executable. Provide only a manual
plan and state the limitation.

### Level 2 — rendered prototype review

Required for normal prototype approval:

- start a local HTTP server;
- open a local URL in a browser or preview surface;
- interact with the page;
- inspect console/runtime errors;
- capture screenshots or use native vision.

Without these capabilities, the agent may produce a draft but must keep it
`needs-review` and label visual verification incomplete. Do not mark it approved
merely from source inspection.

### Level 3 — high-confidence product verification

Preferred for completion:

- DOM evaluation or export;
- accessibility-tree inspection;
- viewport/window resizing and zoom;
- platform-native desktop/mobile runtime;
- automated end-to-end tests;
- image comparison or human visual review.

Use the strongest available combination. A missing optional tool does not justify
fabricating a result.

## Tool-neutral mapping

Map these abstract actions to the current harness:

| Abstract action | Acceptable implementation |
|---|---|
| Ask a focused question | native question tool or one concise chat question |
| Read/write/search | filesystem tools, IDE tools, or shell |
| Preview | built-in browser, Chrome/DevTools connector, IDE preview, or local browser |
| Screenshot | browser screenshot, OS capture, or native vision surface |
| DOM capture | evaluate `scripts/collect_dom_content.js` or export `outerHTML` plus attributes |
| Accessibility check | browser accessibility tree, Playwright/axe, platform inspector, or manual semantics review |
| Real runtime | project-native dev command, emulator, simulator, Tauri/Electron shell, or device |
| Deliver files | attached artifact, exact local path, or repository commit according to harness |

Do not hard-code `Codex Browser`, `AskUserQuestion`, `SendUserFile`, or another
client-specific name in generated project instructions unless that repository is
intentionally tied to that client.

## Questions and ambiguity

Ask only when the answer materially changes product scope, content authority,
source role, destructive Git behavior, or approval. Do not ask for information
that can be established by reading/running the repository.

When the harness cannot ask during execution:

- choose the safest reversible default;
- record assumptions as `unknown` or non-goals;
- stop at approval/destructive boundaries;
- never infer authorization for Git reset, production implementation, remote
  publication, credential use, or third-party upload.

## Browserless fallback

When no browser is available:

1. run static HTML/CSS/JS checks;
2. use source-based content extraction as a fallback;
3. validate files, links, local assets, and JSON contracts;
4. keep the asset `needs-review`;
5. report that visual hierarchy, clipping, runtime interaction, computed
   accessibility, and final DOM content remain unverified.

A browserless result may still be useful, but it is not full design sign-off.

## Multimodal-input fallback

When an attachment or referenced media cannot be accessed:

- do not guess its contents;
- do not rely on a filename, opaque ID, alt text, or user claim as though the media
  was inspected;
- continue only with evidence that is actually available;
- state which design decisions remain blocked or provisional.

## Multi-agent use

Subagents can help with independent read-only audits, accessibility review, or
visual comparison, but they are not required. When used:

- give them the exact mode, repository/design paths, source roles, and read-only
  scope;
- prohibit production writes during design review;
- merge findings through structured contracts rather than free-form prompt chains;
- never let a subagent approve, reset history, publish remotely, or override the
  user's content authority.
