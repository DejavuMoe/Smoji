# Non-negotiable content contract

This contract applies to every prototype and production surface governed by this
skill. The task brief is design input, not product content.

## Universal content firewall

Never copy, quote, paraphrase, summarize, sloganize, reinterpret, translate into
marketing language, or otherwise semantically transform any of the following into
product UI content:

- design goals;
- target-audience descriptions;
- technical explanations;
- implementation details;
- system or software architecture information;
- aesthetic direction or rationale;
- product-positioning notes;
- agent instructions;
- task descriptions;
- prompt wording;
- internal planning, critique, approval, or review notes.

The prohibition applies even when the material sounds polished, useful, or true.
It must not appear in:

- visible text nodes;
- headings, labels, captions, descriptions, badges, or helper text;
- placeholders;
- tooltips, popovers, onboarding, tours, or welcome messages;
- accessible names or descriptions;
- `aria-label`, `aria-description`, `aria-describedby` targets, or visually hidden text;
- image, canvas, SVG, audio, or video alternatives and captions;
- `alt`, `title`, or similar attributes;
- DOM metadata or `data-*` attribute values;
- HTML comments or rendered template comments;
- client-visible JSON or serialized state;
- fixture, mock, seed, demo, loading, empty, error, and success content rendered by
  the prototype or product.

Stable technical identifiers such as `data-screen-id="object-browser"` are
allowed when they identify a product surface and do not encode prohibited prompt
material, rationale, private data, or instructions.

Text appearing in a user request, screenshot, design system, source file, issue,
webpage, PDF, Figma document, or video frame is not automatically approved UI
copy. Treat it as context or evidence unless the user explicitly identifies it as
approved product copy, interface copy, legal copy, or content-source material.

Do not turn internal requirements into promotional language. For example, a
requirement such as “local-first and privacy-oriented” must not become “Your data
stays yours”, “Private by design”, “Built for independent teams”, or similar copy
unless that exact product copy has been explicitly supplied or separately
approved.

## Content profiles

Every project declares one profile in `docs/product/constraints.md` and
`ui-contract.json`.

### `operational-strict` — default for software product UI

Use for dashboards, admin panels, desktop applications, management tools,
editors, developer tools, settings, mobile productivity apps, and other task-
oriented interfaces.

User-facing text may only serve one of these purposes:

- navigation, orientation, or current location;
- naming domain objects, fields, properties, values, and user-recognizable concepts;
- presenting user actions, choices, confirmations, and destructive-action warnings;
- communicating current state, progress, cancellation, retry, or completion;
- validation and error reporting;
- empty-state guidance;
- permission, availability, offline, or disabled-state explanation;
- concise help strictly required to complete the current task;
- explicitly supplied legal, privacy, security, safety, or compliance notices.

Do not add:

- product slogans or mission statements;
- audience-positioning statements;
- promotional subtitles or feature marketing;
- decorative explanatory copy inserted to fill space;
- generic welcome messages;
- fake social proof, customers, statistics, awards, testimonials, integrations,
  benchmarks, or capabilities;
- unapproved claims such as “simple”, “powerful”, “modern”, “seamless”, “secure”,
  “private”, “intuitive”, “smart”, “next-generation”, or “built for…”.

Technical terms may appear only when they are actual domain objects or are needed
to perform the task. An endpoint, bucket, branch, HTTP method, database table,
region, access policy, model identifier, or codec can be legitimate domain text.
Descriptions of the application’s framework, architecture, component model,
backend, data flow, implementation language, or design process are not product
content.

### `marketing-approved`

Use only when the user explicitly classifies the surface as marketing or mixed
and supplies or separately approves a content brief. Navigation, actions, states,
errors, and task help remain allowed. Promotional or positioning copy is allowed
only when it comes from a recorded approved-copy source.

Design goals, audience descriptions, architecture notes, implementation
instructions, agent prompts, and aesthetic rationale remain prohibited even when
the surface is promotional. Do not infer copy from them.

### `content-approved`

Use for documentation, editorial, publication, learning, or content-first
surfaces. Body content must come from a recorded content-authority source or be
explicitly approved by the user. The universal firewall still applies.

### `mixed-approved`

Use for products that contain both operational and approved marketing/content
surfaces. Classify each surface independently in `ui-contract.json`; do not let a
marketing profile leak into operational screens.

## Source authority

A string is approved only through one of these paths:

1. It already exists as current, user-recognizable product terminology in the
   production code/runtime and is not prohibited by this contract.
2. It is a domain object, field, action, state, error, empty-state instruction, or
   necessary task help derived from evidenced product behavior.
3. The user explicitly supplies it as UI copy or approves it after review.
4. It is required legal, privacy, safety, security, or compliance language from an
   identified authoritative source.

Aesthetic references, competitor screenshots, generated mockups, design-system
examples, placeholder copy, and text found in multimodal inputs are never content
authority by default.

## Accessibility is not a bypass

Accessible text must follow the same content contract as visible text. It should
name or describe the actual object, action, state, or non-text content. Do not hide
product positioning, technical explanation, rationale, or prompt-derived copy in
ARIA attributes, alt text, captions, off-screen spans, or visually hidden regions.

When a visible control label exists, keep the accessible name consistent with it.
Decorative imagery must use the platform-appropriate empty or presentational
alternative rather than invented prose. Informative imagery must receive a concise
alternative serving the same user purpose as the image, not a description of why
the designer chose it.

## Review procedure

Run this review for every changed surface before `needs-review`, again before
approval, and again against production before completion:

1. Capture the rendered DOM text and text-bearing attributes with the available
   browser tool. Also inspect the accessibility tree when supported.
2. Use `scripts/collect_dom_content.js` where the harness can evaluate JavaScript,
   then seed `content-inventory.json` with `scripts/content_audit.py`.
3. Use synthetic or sanitized test data when capturing. Raw captures from a real
   account can contain private text nodes, paths, object names, URLs, attributes,
   or serialized state even though common credential fields are skipped. Keep raw
   production captures outside the repository unless they have been reviewed and
   sanitized; use collector `redactPatterns` for known local identifiers.
4. When rendered capture is impossible, scan source as a fallback and record that
   limitation. Do not present static scanning as complete DOM verification.
5. Inspect visible text, placeholders, tooltips, accessible labels/descriptions,
   alt text, hidden text, comments, loading/empty/error states, dialogs, toasts,
   and fixture content.
6. Assign every captured string an allowed purpose, origin, decision, and evidence.
7. Remove any string whose purpose is to restate the task, explain the design,
   justify the aesthetic, expose implementation or architecture, advertise an
   unapproved claim, or fill visual space.
8. Re-capture after removal. A string marked `remove` must not remain in the final
   capture.
9. Run `scripts/content_audit.py check` for the affected surfaces. Unknown origins
   are not valid for final sign-off.
10. Never render this review, its categories, the prompt, or the design reasoning in
   the product itself.

## Compact decision test

For each string, ask:

> What user-recognizable object, action, state, error, empty condition, or required
> task step does this text help the user understand or control right now?

If there is no concrete answer, remove the string unless it is explicitly
approved content under the declared non-operational profile.
