# @lukasbriza/monorepo-template

Universal TypeScript monorepo — **pnpm workspaces + Turborepo** — with generator-driven scaffolding
from canonical templates and shared config/logic packages. Clone it, scaffold what you need, and
inherit the conventions, tooling, and in-repo AI workflow.

## Requirements

- **Node ≥ 22.12** (`.nvmrc` → `v22`)
- **pnpm 9.4** — `corepack enable` then `pnpm install`

## Quick start

```bash
corepack enable
pnpm install
pnpm turbo gen app-next        # scaffold your first app (see below)
```

Optional — develop inside a consistent Linux toolchain (stay in your own editor; output streams to
your terminal):

```bash
pnpm docker:dev     # installs deps, then drops you into a Linux shell (ports published)
pnpm docker:shell   # straight into the shell, skipping the install
```

Inside, work as usual — `pnpm dev`, `pnpm lint`, `pnpm test` — all running on Linux with output in
your terminal. `exit` leaves; the container is disposable, your repo and caches persist.

Expo/React Native work stays on the host (it needs USB devices/emulators and Metro).

## Scaffolding — `turbo gen`

Everything is generated from `templates/` into `apps/` or `packages/` (never hand-copied):

```
pnpm turbo gen app-next            # Next.js (App Router, SSR)   -> apps/<name>
pnpm turbo gen app-react           # React Router (framework, SSR) -> apps/<name>
pnpm turbo gen app-mobile          # Expo (Expo Router, RN)      -> apps/<name>
pnpm turbo gen app-nest            # NestJS (+ optional Prisma 7) -> apps/<name>
pnpm turbo gen app-storybook       # Storybook host              -> apps/storybook
pnpm turbo gen package-tokens      # framework-free design tokens -> packages/tokens
pnpm turbo gen package-api         # shared $api (openapi-fetch) -> packages/api
pnpm turbo gen package-theme       # MUI theme (needs tokens)    -> packages/theme
pnpm turbo gen package-styles      # styled helpers (needs theme)
pnpm turbo gen package-components  # component library (needs theme + styles)
```

Or `/scaffold <type> [name]` from Claude Code (wraps `turbo gen`, validates prerequisites).
**Dependency order:** `tokens → theme → styles → components`.

## What's inside

| Path                | Holds                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `apps/`             | your applications (scaffolded)                                                             |
| `packages/`         | always-on config packages: `eslint-config`, `prettier-config`, `ts-config`                 |
| `templates/`        | canonical sources the generators copy (also workspaces, for full type-awareness)           |
| `turbo/generators/` | the plop generators (`config.ts`)                                                          |
| `docker/`           | `dev/` (Linux dev environment, run via `pnpm docker:*`) + per-runtime **ship** Dockerfiles |
| `.claude/`          | in-repo AI workflow — skills, agents, commands, hooks                                      |

## Shared building blocks

- **`@lukasbriza/tokens`** — framework-free design tokens; the single colour source for the web MUI
  theme and the mobile `@emotion/native` theme.
- **`@lukasbriza/api`** — typed `openapi-fetch` + TanStack Query `$api`, multi-schema via
  `createApiClient`. Apps bind it once in a small `lib/api.ts` (env baseUrl stays per-app).
- **`@lukasbriza/theme` / `styles` / `components`** — the MUI theme system for web apps.

Web apps (`app-next`, `app-react`) ship SSR data via TanStack Query hydration; the mobile app fetches
on mount. State: TanStack Query (server) + Zustand (client UI) + `searchParams`/forms — see the
`coding-conventions` skill.

## Common scripts

```bash
pnpm dev      # turbo dev (apps + packages)
pnpm build    # turbo build
pnpm lint     # turbo lint      ·  pnpm lint:fix
pnpm ts       # turbo typecheck
pnpm test     # turbo test
pnpm format   # prettier --write
```

## Conventions & tooling

- **TypeScript/React conventions** live in `@lukasbriza/eslint-config` (mechanical, enforced) plus the
  `coding-conventions` skill (what tooling can't check). Performance: `web-performance` (web/Next) and
  `native-performance` (Expo/RN) skills.
- **Commits:** Conventional Commits, enforced by commitlint on the `commit-msg` hook. Pre-commit runs
  `lint-staged` (eslint + prettier + `tsc`). See [CONTRIBUTING.md](./CONTRIBUTING.md).

## AI workflow (`.claude/`)

Reusable capabilities are committed **in-repo** and inherited by scaffolded projects: skills
(`coding-conventions`, `web-performance`, `native-performance`, `commit-and-pr`, `plan-project`,
`sync-template`), a `reviewer` / `test-writer` subagent, `/scaffold` and `/review` commands, and git
hooks. Template updates flow into downstream projects via the **`sync-template`** skill (3-way merge on
owned paths, never a blind overwrite).

See [CLAUDE.md](./CLAUDE.md) for the full architecture and AI-workflow reference.
