# Contributing Guide

## 📦 Repository structure & scaffolding

pnpm workspaces + Turborepo. Applications live in `apps/`, shared config in `packages/`, and the
**canonical, real** project bodies in `templates/`. Nothing is hand-copied — scaffolding is
generator-driven from `templates/` into `apps/`/`packages/`:

```bash
pnpm turbo gen <type> --args <answers…>   # e.g. app-next, app-mobile, package-api
```

**Prefer `--args` over the interactive prompt** — turbo's interactive stdin drops keystrokes on
Windows (you'll see typed characters go missing), and `--args` is scriptable. Answers map positionally
to the generator's prompts (`<name> <install>` for apps, `<install>` for fixed-folder packages;
booleans `true`/`false`):

```bash
pnpm turbo gen app-next --args my-web true
pnpm turbo gen app-nest --args my-api true true   # name, +Prisma, install
pnpm turbo gen package-api --args true
```

or `/scaffold <type> [name]` from Claude Code (wraps `turbo gen` with `--args`, validates
prerequisites). The generators are defined in `turbo/generators/config.ts`; edit the matching
`templates/<type>/`, never a scaffolded copy. Dependency order for packages:
`tokens → theme → styles → components`.

Updates to the template propagate into projects built from it via the `sync-template` skill
(3-way merge on owned paths — never a blind overwrite).

## 🛠️ Local development

```bash
corepack enable && pnpm install   # installs deps + sets up husky hooks
pnpm dev        # turbo dev
pnpm lint       # turbo lint      ·  pnpm lint:fix
pnpm ts         # typecheck
pnpm format     # prettier --write
```

- Mechanical style (formatting, import order, `import type`, quotes) is **enforced** by
  `@lukasbriza/eslint-config` + `prettier-config` — don't restate it. Semantic conventions live in the
  `coding-conventions` skill; performance in `web-performance` / `native-performance`.
- **Pre-commit** runs `lint-staged` (eslint + prettier + `tsc` on staged files); **post-commit** updates
  the graphify graph. Build library packages (e.g. `tokens`, `api`) before committing code that imports
  them, so their `dist` resolves for the pre-commit `tsc`.

## 🧪 Testing

All apps and packages **should be covered by tests** where it makes sense.

- Add a `test` script to each package's `package.json` so `pnpm test` (turbo) runs it across the workspace.
- Aim for reliable, reproducible tests that reflect real-world usage. Run them in the dev container
  (below) if you need a Linux-consistent environment.

## 🐳 Docker

Two separate concerns, both under `docker/`:

- **Develop** — `docker/dev/` (Dockerfile + compose) gives one consistent Linux toolchain
  (Node 22 + pnpm) to develop against, whatever the host OS. No `.devcontainer`: you stay in your own
  editor and drive it from the root scripts, with output streaming to your terminal.

  ```bash
  pnpm docker:dev     # installs deps, then drops you into a Linux shell (ports 3000 / 5173 / 6006)
  pnpm docker:shell   # straight into the shell, skipping the install
  pnpm docker:build   # rebuild the dev image after changing docker/dev/Dockerfile
  ```

  You land in `/workspace` as the `node` user and work as usual (`pnpm dev`, `pnpm lint`, `pnpm test`)
  — on Linux, with output in your terminal. `exit` leaves; the container is disposable (`--rm`), while
  the repo, `node_modules` and the pnpm store persist.

  The repo is bind-mounted, so edits on the host apply instantly. `node_modules` and the pnpm store
  live on **named volumes**, so Linux binaries never mix with host-OS ones. **Expo/React Native stays
  on the host** — it needs USB devices/emulators and Metro.

- **Ship** — the per-runtime Dockerfiles (`nextjs/`, `node/`, `node/prisma/`, `postgres/`, `mongodb/`)
  are the recipes CI builds app images from. Those images are OCI-standard: k3s runs them with its
  embedded **containerd**, so no Docker daemon is needed on the cluster.

Keep image changes runtime-specific and reuse the shared Dockerfiles rather than adding per-app ones.

## ✅ Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), **enforced** by
commitlint on the `commit-msg` hook (`@commitlint/config-conventional`). Commits carry **no AI
attribution** (`includeCoAuthoredBy: false`).

**Examples:**

```
feat(app-mobile): add typed routes and error boundary
fix(api): align createApiClient generic with openapi-fetch
chore(deps): bump expo to SDK 56
```

The `commit-and-pr` skill produces messages that pass the hook plus a consistent PR shape.

## 🧭 Final notes

- Always branch for a feature or fix; keep PRs focused — one purpose per PR.
- Match existing conventions; flag inconsistencies rather than introducing a new style.
- Readable, maintainable, testable code over cleverness.
