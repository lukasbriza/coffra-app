# 0023 – Container image: shared Dockerfile for Prisma 7 apps, migrations as a separate command

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

The app is deployed as a container to a homelab (Docker and Portainer, later k3s). The image has to start the server,
be able to apply the migrations, report its health and hold no configuration or secret.

What shapes it:

- The app is CommonJS on Node 22.12 or newer, because `openid-client` is loaded through `require(esm)` (ADR 0007, 0008).
- Prisma 7 with the `pg` driver adapter has no query engine binary: the WASM query compiler comes with
  `@prisma/client`. `prisma migrate deploy` still needs the schema engine, a binary that the install script of
  `@prisma/engines` downloads.
- The generated Prisma client lives in `src/` and is ignored by git, so it does not exist in a fresh checkout and has
  to be generated while the image is built.
- The repository is a pnpm workspace. Its root lists tooling (commit hooks, lint, turbo) as `dependencies`, and pnpm
  adds the dependencies of the workspace root, and of some sibling packages, to every filtered install and to
  `pnpm deploy`.
- The Dockerfile the template kept at `docker/node/prisma/Dockerfile` was written for Prisma 6 and older. It copies a
  query engine binary that Prisma 7 does not have, installs with the scripts of the app (the `postinstall` generates the
  client and needs the schema, which is not there yet), sets `TZ=Europe/Prague` (the API is in UTC), starts the app
  through `pnpm start` as PID 1 and ships the whole workspace.

## Decision

- **One Dockerfile for the NestJS apps of the workspace that use Prisma 7**, `docker/node/prisma/Dockerfile`, which
  replaces the one that was there. The app is chosen by the build argument `APP` (`--build-arg APP=coffra-be`), the
  folder by `APP_FOLDER` and the port by `PORT`. It builds on the official `node:<22.x>-alpine3.22` image with the
  patch version pinned. The build context is the repository root, because `turbo prune` needs the whole workspace.
- **Stages:** toolchain; the pruned workspace (`turbo prune`, with the turbo version the repository declares); build
  (every dependency, no install scripts, `prisma generate`, `nest build`); production dependencies (the dependencies of
  the workspace root dropped from the manifest, `pnpm deploy --prod --ignore-scripts`, then the install script of
  `@prisma/engines` run on its own); runtime. The runtime holds the compiled app, the production `node_modules`, the
  Prisma schema, the migrations and `prisma.config.ts`: no source, no tests, no dev dependencies, no pnpm, no `.env`.
- **Runs as `node`**, and the code is read-only for it. The only baked variables are `NODE_ENV=production` (it
  switches on the `https` checks of the configuration) and `PORT`. There is no `TZ`, so the container is in UTC like the
  API. Every other setting and every secret comes from the environment at run time, never from a build argument.
- **The main process is `node build/main`**, not `pnpm start`, so Node is PID 1 and receives SIGTERM; the shutdown
  hooks close the HTTP server and the database connections.
- **The health check is a `HEALTHCHECK` that runs `node`** to call `GET /api/health`, because Node is the one tool the
  image is certain to have. The route answers `503` when the database does not, so `unhealthy` means a broken app.
- **Migrations do not run on start.** The same image has a second command,
  `node node_modules/prisma/build/index.js migrate deploy` (working directory `/app/<APP_FOLDER>/<APP>`). Compose runs it
  as a one-shot service the app waits for, k3s as a `Job` or an `initContainer`. `prisma` therefore stays in
  `dependencies`.
- **The image is checked by `pnpm test:image`** (ADR 0019 covers the other suites): it starts the image against a real
  Postgres, applies the migrations with it, and checks the health check, a refused configuration, SIGTERM and what the
  image does and does not contain.

## Alternatives considered

- **Patch the previous Dockerfile and keep its shape** – three small patches were enough to make it build and run, and
  the result was worse: about 1 GB with 954 packages and the whole workspace, `pnpm` as PID 1 (a stop ended with exit
  code 1), no health check, the code writable by the app user, `TZ=Europe/Prague`. Fixing those changes nearly every
  step.
- **A Dockerfile of its own beside the app** – no clash with the Dockerfile in `docker/`, but a second one in the
  repository that can drift away from it.
- **Migrate in the entrypoint at every start** – a failing migration would restart the app in a loop instead of failing
  once and visibly, a rolling update would migrate while the old replicas still run, and the app would hold the
  rights to change the schema for good. Prisma takes an advisory lock, so two replicas cannot corrupt each other, but
  the other reasons stand.
- **A second image (`--target`) for migrations, without the Prisma CLI in the runtime** – the runtime would lose about
  230 MB (the CLI, Prisma Studio, the embedded Postgres it depends on), at the price of a second image to tag, build
  and deploy. Worth revisiting if the size starts to matter.
- **`pnpm install --prod --filter` or `pnpm prune --prod` for the production dependencies** – both bring the
  dependencies of the workspace root and of the shared config packages (measured: 969 packages against 272).
- **A Debian (`slim`) base** – larger; Alpine runs the schema engine with the `libssl3` it already has, no extra package.
- **`wget` or `curl` for the health check** – busybox has `wget`, but a base image change would take it away.

## Consequences

- The image is about 740 MB uncompressed, of which the production `node_modules` are about 370 MB. About 230 MB of that
  is the Prisma CLI and what it pulls in, shipped so that the image can migrate.
- A build needs network access: corepack downloads pnpm and `@prisma/engines` downloads the schema engine.
- `pnpm deploy` re-resolves the peers of the production tree. The peer dependencies of Prisma Studio (React) are absent
  on purpose, so strict peer checking is switched off for that one command. The versions still come from the lockfile:
  the set of packages is a subset of the one a frozen install gives.
- `npm pkg delete dependencies` in the production stage is there only because the root lists tooling as
  `dependencies`. Moving the root tooling to `devDependencies` would make it unnecessary.
- Docker runs the `HEALTHCHECK`; k3s ignores it and needs liveness and readiness probes on the same URL.
- Without the shutdown hooks (`enableShutdownHooks` in `configureApp`) PID 1 ignores SIGTERM and the container is killed
  after the grace period; the image suite fails on that.
- The Dockerfile is shared: every NestJS app of the workspace with Prisma 7 builds with it. A project still on Prisma 6
  (query engine binary) needs a Dockerfile of its own, and the template that carries this file has to be updated with it.
- A new production dependency needs nothing here. A script a service has to run from the image has to be part of the
  compiled `build/`; `src/` and `test/` are not in the image.
