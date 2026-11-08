# 0030 – Continuous integration: three jobs, the project's own packages

- **Status:** Accepted
- **Date:** 2026-11-08

## Context

Only the developer's machine and the commit hooks ran the checks. They come in three kinds with different needs:
lint, types, the unit and e2e specs and the build need nothing but Node; the integration specs need a Postgres and a
Redis (ADR 0019, 0026); the image specs need Docker as well and an image built first (ADR 0023).

The workspace is bigger than the project. The templates in `templates/*` are workspaces too (Expo, Next.js, React
Router, Storybook), and a filtered `pnpm install` still installs every one of them (pnpm 9.4, measured). Three facts of
the repository shape the workflow:

- `.editorconfig` asks for CRLF and Prettier, which ESLint runs, follows it. The repository stores LF; the developer's
  Windows checkout has CRLF through `core.autocrlf`. A Linux checkout has LF, and the lint fails on every line of every
  file.
- The root `prettier.config.js` loads the built `@lukasbriza/prettier-config`, whose `dist` is not in the repository and
  is not a dependency of the app, so nothing builds it before the lint.
- Turbo runs tasks in strict environment mode: a variable that `turbo.json` does not declare (`TEST_DATABASE_URL`,
  `TEST_REDIS_URL`) does not reach the task.

## Decision

**One workflow (`.github/workflows/ci.yml`) on every pull request to `master`, every push to it and on demand, with
three independent jobs.** Each checks out, installs and fails on its own, so a failure names its kind:

| Job           | Runs                                                               | Services        |
| ------------- | ------------------------------------------------------------------ | --------------- |
| `check`       | lint, types, `pnpm test` (unit, then e2e), build, format           | none            |
| `integration` | `pnpm test:integration`                                            | Postgres, Redis |
| `image`       | `pnpm image:build`, then `pnpm test:image` against the built image | Postgres, Redis |

- **The project's packages only.** `check` runs turbo with `--filter=@lukasbriza/coffra-be...` and
  `--filter=@lukasbriza/coffra-api...`: the app, the API package (whose test holds its types to the published schema,
  ADR 0028) and the shared configuration they use. The templates are installed, because the install cannot leave them
  out, but never checked here.
- **The suites with services run through pnpm, not turbo**, so their `TEST_*` variables arrive. They are not turbo tasks
  anyway, and a cached suite would be a suite that did not run against the database.
- **The services are the images of the dev compose** (`postgres:17.5-alpine3.22`, `redis:8.2-alpine3.22`) with the same
  public credentials. The integration suite creates, migrates and drops its database itself; the containers of the
  image suite reach the services through `host.docker.internal` (`host-gateway`).
- **The image is built and started, never published.** Only the image specs prove that it starts, migrates and stops;
  a job that only builds would pass an image that cannot start. The build comes before the install, so a broken
  Dockerfile fails first.
- **Line endings:** `check` sets `core.autocrlf true` before the checkout, so it lints the same CRLF files the developer
  does, and verifies that before anything else. The other jobs run no formatter and keep the LF checkout. Dockerfiles
  are LF in every checkout (`.gitattributes`): BuildKit passes a CR at the end of a heredoc line to the shell
  (`set -e\r`), so a CRLF checkout could not build the image.
- **`@lukasbriza/prettier-config` is built before the lint**, as a step of its own.
- **The least the workflow can hold:** `permissions: contents: read`, no secrets, `persist-credentials: false`, every
  action pinned to the full commit of a release with the version in a comment, a release some weeks old rather than one
  of the last days, and a fixed runner (`ubuntu-24.04`) instead of `ubuntu-latest`. Node comes from `.nvmrc`, pnpm from
  `packageManager`, the pnpm store is cached by `actions/setup-node`.
- **No path filter.** The checks are meant to be required on `master`, and a required check that a path filter skips
  never reports. Making them required is a setting of the repository, not part of the workflow.

## Alternatives considered

- **One job for everything** – one install, but the services would be up for the lint, and a failure would name a step
  in a long log instead of a job.
- **The whole workspace, templates included** (the root `pnpm lint`, `pnpm test`) – checks code this project does not
  own and that the template repository checks; slower, and a broken template would block the app.
- **LF everywhere** (`.editorconfig` and `.gitattributes`), or Prettier with `endOfLine: 'auto'` – the cleaner rule, but
  a change of the template and the shared configuration, not of this project. The CI step goes away once the rule
  changes.
- **The suites through turbo with `passThroughEnv`** – turbo would also cache them by their inputs, and a suite against a
  database must run every time.
- **Build the image only** – shorter by about a minute, and proves only that the Dockerfile builds.
- **A layer cache for the image build** (`docker/build-push-action` with the GitHub Actions cache) – a faster build for
  two more actions with access to the job; worth it once the build time hurts.
- **A composite action for the shared setup** – one place for four steps, but a second file to read to understand any
  job.

## Consequences

- A pull request shows three checks. A failing integration spec fails `integration` only, a broken image `image` only,
  a type error or a failing unit spec `check` only.
- A new variable a suite needs goes into the `env` of its job as well. A new service of the suites goes into
  `services` of both jobs that run them.
- Updating an action means a new commit hash by hand; nothing updates them automatically.
- `.nvmrc` names the major version, so CI gets the newest Node 22 while the image pins one; both satisfy the minimum of
  ADR 0008.
- A change of a shared package that breaks only a template shows up in the root `pnpm lint` on a developer's machine,
  not in CI.
