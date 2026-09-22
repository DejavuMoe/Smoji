# Project-local skills

These are ordinary repository files, usable by any file-capable AI Agent.
The root AGENTS.md supplies discovery for agents without automatic skill loading.

- `prototype-first-ui`: v2.0.0, installed from the user-supplied local package on
  2026-09-22. Package contents preserved except generated Python bytecode.
- `baoyu-design`: required dependency from
  https://github.com/JimLiu/baoyu-design/tree/026d4ea012bdd5cada72ac8cc13f21ba4edf2245/skills/baoyu-design
  installed at that immutable revision using the skill installer with an explicit
  project destination. No optional external skills were installed.

Upstream license files are retained. Installation requires no global skill
directory, agent-specific symlink or machine-specific path in project rules.
