# CLAUDE.md — monorepo-template

Durable context for this monorepo and every project scaffolded from it. Keep it tight
and high-signal. Per-app specifics live in each app's own `CLAUDE.md`.

## Stack & tooling

- Package manager: **pnpm** (`workspace:*` for internal deps). Node **>= 22**.
- Build orchestration: **Turborepo** (`turbo.json`). TypeScript 5.5.
- Workspaces: `apps/*` (deployables) and `packages/*` (libraries & shared config).
- Shared config consumed as packages, not copied:
  `@lukasbriza/eslint-config`, `@lukasbriza/prettier-config`, `@lukasbriza/ts-config`.
- Commits: Conventional Commits enforced by commitlint; husky runs `pre-commit`
  (lint-staged) and `commit-msg`.

## Core rule: config is a dependency, not a copy

Shared tooling lives in `packages/*` and is consumed via `workspace:*`. Do not copy
eslint/prettier/tsconfig content into apps — extend the shared package. If a convention
must change, change it in the shared package so every workspace inherits it.

## Adding an app or package — use `turbo gen`

Scaffolding is generator-driven from canonical templates in `templates/`:

```
pnpm turbo gen app-next            # Next.js app             -> apps/<name>
pnpm turbo gen app-react           # React Router (SSR) app  -> apps/<name>
pnpm turbo gen app-mobile          # Expo (Expo Router) app  -> apps/<name>
pnpm turbo gen app-nest            # NestJS app (+Prisma 7)  -> apps/<name>
pnpm turbo gen app-storybook       # Storybook host (+theme) -> apps/storybook
pnpm turbo gen package-tokens      # framework-free tokens   -> packages/tokens
pnpm turbo gen package-api         # shared $api (openapi)   -> packages/api
pnpm turbo gen package-theme       # shared MUI theme        -> packages/theme    (needs tokens)
pnpm turbo gen package-styles      # styled helpers          -> packages/styles   (needs theme)
pnpm turbo gen package-components  # component library       -> packages/components (needs theme + styles)
```

Shared logic packages (`tokens`, `api`) are the DRY home for cross-app code: design tokens
(consumed by the web theme and the mobile theme) and the typed `$api` (consumed by every app via
a small per-app `lib/api.ts` that supplies the env baseUrl). Apps that use them depend on
`@lukasbriza/api` / `@lukasbriza/tokens` (`workspace:*`), so scaffold those packages first.

- `templates/<type>/` holds the **canonical, real** project body (single source of
  truth). Generators copy it into `apps/`/`packages/` and post-process (rename, optional
  variants, drop per-workspace `CLAUDE.md`), then optionally run `pnpm install` + `lint:fix`.
- Generators are defined in `turbo/generators/config.ts`.
- `templates/*` **are** workspaces (installed for full type-awareness, linting and
  type-checking), but `pnpm dev` / `pnpm build` scope to `--filter="./apps/*" --filter="./packages/*"`
  so templates never run or build as phantom apps. (Positive filters, not a lone
  `!./templates/*` which selects nothing; escaped double quotes so it works on Windows `cmd`.)
- Dependency order: `package-tokens` → `package-theme` → `package-styles` → `package-components`;
  generators guard against missing prerequisites. `package-api` has no prerequisites but is consumed
  by apps, so scaffold it before its consumers.

Scaffolding is fully generator-based (the legacy `packages/cli` has been removed).

## Common tasks

```
pnpm dev        # turbo dev (persistent)
pnpm build      # turbo build
pnpm lint       # turbo lint        | pnpm lint:fix
pnpm ts         # turbo typecheck
pnpm test       # turbo test
pnpm format     # prettier write
```

## AI workflow

- Reusable AI capabilities live in `.claude/` (skills, agents, commands, hooks) and are
  distributed **in-repo**: committed here and inherited by scaffolded projects.
- Subagents (`.claude/agents/`): `reviewer` — read-only code review of a diff, tuned to this
  stack ("review my changes"); `test-writer` — writes vitest specs (Nest services/controllers
  with `@nestjs/testing`, `@testing-library/react` components), test-files only.
- Commands (`.claude/commands/`): `/scaffold <type> [name]` wraps `turbo gen` (validates type,
  prerequisites, runs non-interactively); `/review [target]` dispatches the `reviewer` subagent.
- `coding-conventions` (`.claude/skills/coding-conventions`) captures cross-cutting TypeScript
  conventions (SKILL.md, always-lean) plus per-framework detail loaded on demand
  (`references/{react,react-native,nextjs,nestjs}.md`). It fires when writing/reviewing code and
  complements — doesn't duplicate — `@lukasbriza/eslint-config` (mechanical, enforced) and the
  per-workspace `CLAUDE.md`.
- `web-performance` (`.claude/skills/web-performance`) — curated React/Next/RSC/bundle/JS
  performance rules (index + `rules/<name>.md`), the performance axis on top of the conventions.
- `native-performance` (`.claude/skills/native-performance`) — the same axis for Expo/React Native
  (list virtualization, Reanimated UI-thread animations, `expo-image`); kept separate from
  `web-performance` so each stays runtime-focused.
- `commit-and-pr` (`.claude/skills/commit-and-pr`) — Conventional-Commits messages that pass the
  commitlint `commit-msg` hook, plus a consistent PR shape. Commits/PRs carry **no AI attribution**
  (`settings.json` sets `includeCoAuthoredBy: false`).
- `plan-project` (`.claude/skills/plan-project`) — main-thread planner: clarifies a thin brief with
  the requester, produces a scoped plan + roadmap, decomposes into tasks, and writes them as GitHub
  issues on the repo's Project (reuse the linked Project or create one). GitHub is the source of
  truth; `references/github.md` holds the `gh` playbook.
- Hooks (`.claude/settings.json`, committed): a `PreToolUse` guard
  (`.claude/hooks/guard-generated.mjs`) blocks `Write`/`Edit` into generated/build output
  (`dist/`, `build/`, `.next/`, `.turbo/`, `coverage/`, `*.tsbuildinfo`, prisma `generated/`,
  openapi `api.d.ts`). Formatting/linting stays at commit time (husky + lint-staged) — no
  auto-format hook, which would desync in-progress `Edit` matches.
- Knowledge graph: the `graphifyy` CLI (installed per-machine — `pip install graphifyy`) builds a
  graph into `graphify-out/` (gitignored, regenerable — never commit it). Build via the **terminal
  CLI** (`graphify .`) or the `.husky/post-commit` hook (`graphify . --update`, backgrounded) — both
  run without an agent.
  - **Code-only by default.** `.graphifyignore` excludes docs/papers/images, so the build is
    AST-only: no LLM, no API key, **no token cost**. (`.graphifyignore` _replaces_ the root
    `.gitignore` for graphify, so it also re-lists deps/build/**secrets** — keep those in sync.)
  - **Never run semantic (doc) extraction through Claude.** With no external key graphify uses the
    _host agent itself_ as the LLM — i.e. it burns your Claude session quota summarising every
    markdown file. If you ever want docs graphed, set `GEMINI_API_KEY` (free tier) and run the CLI in
    a terminal; never via `/graphify` inside Claude Code, never on the Claude quota.
  - **Never read `graphify-out/graph.json` or `graph.html` into context** (≈1 MB each). Query the
    graph instead: `graphify query "…"`, `graphify path A B`, `graphify explain Node`.
- Updates flow into existing projects via the `sync-template` skill: the template is a
  git remote (`template`), the last synced ref is recorded in `.claude/.template-ref`,
  and only the template's delta on owned paths is applied via 3-way merge (never a blind
  overwrite). See `.claude/skills/sync-template`.

## Guardrails

- Never edit generated/build output: `.next/`, `dist/`, `.turbo/`, `*.tsbuildinfo`,
  `node_modules/`.
- Edit conventions in `templates/` and shared `packages/*`, not in scaffolded copies —
  otherwise changes can't propagate.
- Never commit `.env.local` or other secrets; ship `.env.example` instead.
