---
name: writing-skills
description: Use when creating a new skill in .claude/skills/, updating an existing skill, reviewing skill quality, or when asked to document a codebase pattern as a reusable agent instruction. Also covers adding a subagent (.claude/agents/) or a slash command (.claude/commands/) and deciding which of the three a concern belongs in.
---

## Overview

Writing skills IS Test-Driven Development applied to process documentation. The iron law:
**NO SKILL WITHOUT A FAILING TEST FIRST.** Before writing a skill, demonstrate that the agent
behaves incorrectly without it. Then write the minimal skill that fixes the failure.

A skill is a `SKILL.md` in `.claude/skills/<skill-name>/SKILL.md` that teaches the agent how
to handle one area of this **pnpm + Turborepo TypeScript monorepo**. Skills live in-repo and
are inherited by every project scaffolded from this template, so they must not depend on
anything that exists only in one project.

---

## When to Use

- Creating a new skill for an undocumented area
- Updating an existing skill that no longer matches the code
- Reviewing whether a skill is effective or has gaps
- Deciding between a skill, a subagent, and a slash command

---

## Which mechanism

| Concern | Mechanism | Lives in |
|---|---|---|
| Durable knowledge the agent needs while working | skill | `.claude/skills/<name>/` |
| A role with its own context and tool scope | subagent | `.claude/agents/<name>.md` |
| A repeatable workflow invoked on demand | command | `.claude/commands/<name>.md` |
| Deterministic automation around the lifecycle | hook | `.claude/hooks/` + `settings.json` |
| Always-on project context | `CLAUDE.md` | repo root or workspace root |

A command that needs more than ~40 lines of knowledge is a skill with a thin command in front
of it. A task that burns a lot of context before producing its answer is a subagent. The
`/design` → `design-build` → `design-to-figma` trio is the canonical example of all three.

---

## Core Pattern: RED-GREEN-REFACTOR

### RED — Establish Baseline Failure

1. Identify a task the agent handles poorly without guidance
2. Run the task WITHOUT the skill present
3. Document exact failures: wrong patterns, missed conventions, broken rules
4. Note the rationalizations the agent uses to justify shortcuts

Real baseline failures in this monorepo:

- Agent copies eslint/prettier/tsconfig content into an app instead of extending the shared package
- Agent deep-imports `@lukasbriza/theme/src/...` instead of the package root
- Agent hand-patches a scaffolded app for something that belongs in `templates/`
- Agent derives state with `useEffect` instead of computing it
- Agent writes `function foo() {}` instead of an arrow-function const
- Agent edits generated output (`dist/`, prisma `generated/`, openapi `api.d.ts`)
- Agent puts logic in a Nest controller instead of a service

### GREEN — Write Minimal Skill

1. Write the smallest skill that addresses the documented failures
2. Re-run the same task WITH the skill present
3. Verify the agent now follows the correct pattern
4. If failures persist, expand the skill — do not deploy a broken skill

### REFACTOR — Close Loopholes

1. Test under pressure: complex tasks, time constraints, multiple concerns
2. Watch for new rationalizations or workarounds
3. Add explicit counters for each identified workaround
4. Re-test until the skill is reliable

---

## Skill File Structure

```markdown
---
name: kebab-case-name
description: Use when [specific triggering conditions].
---

## Overview
One paragraph: what this skill covers and why it exists.

## When to Use
Bullet list of concrete triggers.

## Core Pattern / Quick Reference
Tables, code blocks, checklists — the main content.

## Common Mistakes
What the agent gets wrong without this skill.
```

Supporting files, loaded only when the skill points at them:

| Subfolder | Use | Example |
|---|---|---|
| `references/` | per-topic detail the skill links to | `coding-conventions/references/nestjs.md` |
| `rules/` | one file per atomic rule, indexed by `SKILL.md` | `web-performance/rules/*.md` |
| `scripts/` | executable the skill invokes | `sync-template/sync.sh` |

### Frontmatter Rules

| Field | Rule |
|-------|------|
| `name` | Lowercase, hyphens only. Must match folder name. |
| `description` | Starts with "Use when...". Max 1024 chars. Describes WHEN to activate, not WHAT the skill contains. |

### The Description Is Critical

The `description` field determines when the agent loads the skill. A vague description means
the skill is never activated, or activated at the wrong times.

**Good:** `Use when writing, editing, or reviewing any code in this monorepo — TypeScript,
React/MUI, Next.js, React Native (Expo), or NestJS: components, hooks, routes, modules, types,
state, or naming.`

**Bad:** `Skill about code conventions and how we write things.`

Rules:

- Start with "Use when..."
- List concrete triggers: file globs, framework names, workflow steps, command names
- Say what the skill is **not** for when a neighbouring skill owns that ground
- Never summarize the workflow — only describe activation conditions

---

## Content Guidelines

### What to Include

- **File paths and directory structure**, as globs that hold in any scaffolded project
- **Code patterns** with real examples from this monorepo (not generic React/TS)
- **Checklists** for multi-step workflows
- **Tables** for quick reference (conventions, types, destinations)
- **Rules and constraints** the agent cannot derive by reading code alone
- **Common mistakes** specific to this area

### What NOT to Include

- Generic TypeScript/React advice — the agent already knows this
- Rules already in `CLAUDE.md` or enforced by `@lukasbriza/eslint-config` — cross-reference instead
- Long narrative explanations — prefer tables, code blocks, bullets
- Outdated patterns — verify against current code before writing
- Information the agent can discover by reading the file
- Paths into a specific scaffolded project or another repository
  (`<repo>/apps/<app>/...`) — template skills ship to every project, where those files do not
  exist. Inline the content in the skill or its `references/` instead

---

## Anti-Patterns

| Anti-Pattern | Why It Fails |
|---|---|
| Narrative examples tied to sessions | Becomes stale immediately, wastes tokens |
| Descriptions that summarize workflow | Agent loads skill at wrong times or never |
| Duplicating `CLAUDE.md` rules | Creates conflicts when rules are updated in one place |
| Generic code examples | Agent ignores them — use real project patterns |
| Deploying untested skills | No evidence the skill actually changes agent behavior |
| Skills over 400 lines | Token waste — split into focused skills or trim |
| A folder with `references/` but no `SKILL.md` | Loads nothing; it is dead weight, not a skill |

---

## Token Efficiency

A skill's `SKILL.md` is loaded whenever it fires. Every word competes with the actual task.

- Target **under 200 words** for frequently-loaded skills
- Maximum **400 lines** for any `SKILL.md` — push detail into `references/` or `rules/`
- Use tables instead of prose for reference data
- Cross-reference other skills (`see skill: coding-conventions`) instead of repeating content
- Compress code examples to the minimum that shows the pattern

---

## Existing Skills — Check Before Creating

| Skill | Area |
|-------|------|
| `coding-conventions` | TypeScript, React/MUI, Next, Expo, Nest conventions; `references/<framework>.md` |
| `web-performance` | React/Next/RSC/bundle/JS performance rules |
| `native-performance` | Expo/React Native performance rules |
| `commit-and-pr` | Conventional Commits that pass commitlint, PR shape |
| `plan-project` | Brief → scoped plan → tasks as GitHub issues |
| `deploy-k8s` | Helm chart, release workflow, Infisical, ArgoCD hand-off |
| `design-to-figma` | Visual direction, design tokens, screens, Figma handoff |
| `sync-template` | Pulling template deltas into a scaffolded project |
| `writing-skills` | How to create and maintain skills |

Subagents: `reviewer` (read-only diff review), `test-writer` (vitest specs),
`design-build` (design phases 0–3).
Commands: `/scaffold`, `/review`, `/design`.

Before creating a new skill, check whether the topic fits into an existing one. Extending an
existing skill is better than creating overlap.

---

## Quality Checklist

Before deploying a skill, verify:

- [ ] **RED tested:** Documented baseline failure without the skill
- [ ] **GREEN tested:** Verified the skill fixes the failure
- [ ] **REFACTOR tested:** Closed loopholes under pressure scenarios
- [ ] `name` matches the folder name
- [ ] `description` starts with "Use when..." and lists concrete triggers
- [ ] No duplication with `CLAUDE.md` or `@lukasbriza/eslint-config`
- [ ] No overlap with another skill (cross-reference instead)
- [ ] Paths are globs that hold in any scaffolded project, not one repo's layout
- [ ] All code examples match current monorepo patterns
- [ ] Content is concise — tables and code blocks over prose
- [ ] `SKILL.md` is under 400 lines
- [ ] Added to the inventory table above, and to `CLAUDE.md`'s AI workflow section
