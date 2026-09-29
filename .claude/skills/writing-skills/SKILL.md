---
name: writing-skills
description: Use when creating a new skill file in .agents/skills/, updating an existing skill, reviewing skill quality, or when asked to document a codebase pattern as a reusable agent instruction.
---

## Overview

Writing skills IS Test-Driven Development applied to process documentation. The iron law: **NO SKILL WITHOUT A FAILING TEST FIRST.** Before writing a skill, demonstrate that the agent behaves incorrectly without it. Then write the minimal skill that fixes the failure.

A skill is a `SKILL.md` file in `.agents/skills/<skill-name>/SKILL.md` that teaches the AI agent how to handle a specific area of this React/Ionic/TypeScript codebase.

---

## When to Use

- Creating a new skill for an undocumented codebase area
- Updating an existing skill that no longer matches the code
- Reviewing whether a skill is effective or has gaps

---

## Core Pattern: RED-GREEN-REFACTOR

### RED — Establish Baseline Failure

1. Identify a codebase task the agent handles poorly without guidance
2. Run the task WITHOUT the skill present
3. Document exact failures: wrong patterns, missed conventions, broken rules
4. Note specific rationalizations the agent uses to justify shortcuts

Examples of baseline failures in this project:
- Agent uses `useContext` directly instead of `useContextSelector`
- Agent calls `fetcher()` from a component instead of through a hook
- Agent hardcodes text instead of using `t('key')`
- Agent edits auto-generated types in `src/api/types/` manually

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

### Frontmatter Rules

| Field | Rule |
|-------|------|
| `name` | Lowercase, hyphens only. Must match folder name. |
| `description` | Starts with "Use when...". Max 1024 chars. Describes WHEN to activate, not WHAT the skill contains. |

### The Description Is Critical

The `description` field determines when the agent loads the skill. A vague description means the skill is never activated or activated at wrong times.

**Good:** `Use when working on the MySeptim API layer, including endpoints, request functions, API hooks, generated API types, mocks, headers, and API error handling.`

**Bad:** `Skill about the API and how requests work.`

Rules:
- Start with "Use when..."
- List concrete triggers: file names, component types, workflow steps
- Never summarize the workflow — only describe activation conditions

---

## Content Guidelines

### What to Include

- **File paths and directory structure** relevant to the area
- **Code patterns** with real examples from this codebase (not generic React/TS)
- **Checklists** for multi-step workflows (e.g. "New Endpoint Checklist")
- **Tables** for quick reference (constants, hooks, error codes, conventions)
- **Rules and constraints** the agent cannot derive by reading code alone
- **Common mistakes** specific to this area

### What NOT to Include

- Generic TypeScript/React advice — the agent already knows this
- Rules already in AGENTS.md — cross-reference instead of duplicating
- Long narrative explanations — prefer tables, code blocks, bullets
- Outdated patterns — verify against current code before writing
- Information the agent can discover by reading the file (e.g. function signatures that are obvious from the source)

---

## Anti-Patterns

| Anti-Pattern | Why It Fails |
|---|---|
| Narrative examples tied to sessions | Becomes stale immediately, wastes tokens |
| Descriptions that summarize workflow | Agent loads skill at wrong times or never |
| Duplicating AGENTS.md rules | Creates conflicts when rules are updated in one place |
| Generic code examples | Agent ignores them — use real project patterns |
| Deploying untested skills | No evidence the skill actually changes agent behavior |
| Skills over 400 lines | Token waste — split into focused skills or trim |

---

## Token Efficiency

Skills are loaded into context automatically. Every word costs tokens and competes with the actual task.

- Target **under 200 words** for frequently-loaded skills
- Maximum **400 lines** for any skill — split if larger
- Use tables instead of prose for reference data
- Cross-reference other skills (`see skill: api-layer`) instead of repeating content
- Compress code examples to the minimum that shows the pattern

---

## Existing Skills — Check Before Creating

| Skill | Area |
|-------|------|
| `api-layer` | Endpoints, requests, hooks, mocks, error handling |
| `build-runtime-resources` | Build process, deployment, Capacitor |
| `contacts-and-resources` | Team contacts and external resources |
| `coding-conventions` | Naming, components, state, routing, HOCs, CSS, i18n, TypeScript (supersedes `naming-and-components`, `state-routing-hoc`, `styling-localization-typescript`) |
| `project-overview` | High-level project architecture |
| `testing-patterns` | Unit tests, E2E tests, MSW mocks |
| `systematic-debugging` | Root cause analysis, 4-phase debugging process |
| `verification-before-completion` | Verification gate before completion claims |
| `writing-skills` | How to create and maintain skills |

Before creating a new skill, check if the topic fits into an existing one. Extending an existing skill is better than creating overlap.

---

## Quality Checklist

Before deploying a skill, verify:

- [ ] **RED tested:** Documented baseline failure without the skill
- [ ] **GREEN tested:** Verified the skill fixes the failure
- [ ] **REFACTOR tested:** Closed loopholes under pressure scenarios
- [ ] `name` matches the folder name
- [ ] `description` starts with "Use when..." and lists concrete triggers
- [ ] No duplication with AGENTS.md
- [ ] No overlap with other skills (cross-reference instead)
- [ ] All file paths exist and are relative to project root
- [ ] All code examples match current codebase patterns
- [ ] Content is concise — tables and code blocks over prose
- [ ] Skill is under 400 lines
