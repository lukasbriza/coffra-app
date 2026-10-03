# CLAUDE.md — NestJS app

Per-app context. Inherits monorepo conventions from the root `CLAUDE.md`; this file
covers only what is specific to a NestJS app.

## Stack

- NestJS 11 (Express 5 platform), TypeScript (CommonJS output via `nest build` → `build/`).
- Swagger at `/api/swagger` (`@nestjs/swagger`), config via `@nestjs/config` + dotenv.
- Validation: `class-validator`. Tests: **vitest** (`vitest.config.mjs`).

## Layout

- `src/main.ts` — bootstrap (Nest factory, port from `ConfigService`).
- `src/app.setup.ts` — `configureApp(app)`: global prefix `api`, `ValidationPipe`, shutdown hooks. Shared with tests.
- `src/swagger.setup.ts` — `buildSwaggerDocument` / `setupSwagger` (bearer auth, UI at `/api/swagger`).
- `src/modules/health/` — `GET /api/health` (`@nestjs/terminus`, DB check via `PrismaHealthIndicator`).
- `src/app.module.ts` — root module; register domain modules here (imported from their `index.ts`).
- Domains in `src/modules/{core,transactions,dashboard}/` (module + controller + service + dto, grouped in subfolders).
- Infrastructure modules (not domains): `src/modules/{config,health,prisma}/`, each with an `index.ts`.

## Module boundaries

Modular monolith: one Nest app, a domain = a module in `src/modules/<domain>/`.

1. A domain exports only through its `index.ts`. Everything else imports `'../<domain>'`, never `'../<domain>/…'`.
2. A domain touches only its own Prisma models (`prisma/schema/<domain>.prisma`). Foreign data comes through a public service of the other domain.
3. Dependency direction is `core` ← `transactions` ← `dashboard`. `core` imports no domain, `transactions` only `core`, `dashboard` `core` and `transactions`.
4. The only allowed relations between schemas are foreign keys to `User` and `tenantId`.

- **No rule is lint-enforced** (deliberately dropped): the boundaries hold by discipline and review. Inside its own domain, files import freely.
- `config`, `health` and `prisma` are infrastructure: reachable from anywhere through their `index.ts`, but they import no domain.
- Adding a domain: folder + `<domain>.module.ts` + `index.ts`, an import in `AppModule`.

## Architecture decisions

Significant architectural decisions are written as separate markdown files in `docs/decisions/`, one per
decision, named `NNNN-kebab-title.md` (next free number). Format and the index are in
`docs/decisions/README.md`. The point is that a developer (or an AI agent) debugging or changing the
code later can see **why** something was built that way, not only what it does.

- **Read first:** when debugging, or when a design looks odd (a CHECK constraint, a pinned dependency, a missing `userId`, a module boundary), look in `docs/decisions/` for the reason before changing it.
- Write one when you pick between real alternatives with lasting consequences (module boundaries, data model, auth/session, a dependency pinned for a structural reason). Not for routine implementation choices.
- Record the context, the alternatives you rejected and the consequences, not only the outcome.
- Write it in the same PR as the change, and add it to the index.
- Do not rewrite an accepted decision. To change course, add a new record and mark the old one `Superseded by NNNN`.

## Conventions

- One module per feature; keep controllers thin, logic in services (DI).
- DTOs validated with `class-validator`; enable a global `ValidationPipe` when adding input.
- All routes live under the `api` prefix. New endpoint tests must boot via `configureApp(app)`.
- **Inject with `@Inject(Token)` on every constructor parameter.** Vitest (esbuild) emits no decorator metadata, so type-based injection resolves to `undefined` in `Test.createTestingModule`.
- `@nestjs/terminus` is pinned to 11.x: 12.x is ESM-only and this app is CommonJS.
- Run: `pnpm dev` (watch), `pnpm build`, `pnpm test`, `pnpm lint`.

## Dev environment (Postgres + Keycloak)

`docker/docker-compose.yaml` (project `coffra-dev`). **DEV ONLY — all credentials are public.**

```
pnpm infra:up      # postgres + keycloak, waits for healthchecks (Keycloak cold start ~30 s)
pnpm infra:down    # stops containers; Postgres data stays on volume `coffra-pgdata`
pnpm infra:logs
```

- Never run `docker compose down -v` — it deletes `coffra-pgdata` (the dev database).
- `pnpm dev` does not start Docker; run `infra:up` first. Ports bind to `127.0.0.1` only.
- Postgres: `localhost:5439`, user/password `coffra`, DB `coffra_dev` (= `DATABASE_URL` in `.env.example`).
- Keycloak: `http://localhost:8080`, admin console `admin` / `admin`. Realm `coffra`, client `coffra-be`
  (confidential, secret `coffra-dev-secret`, PKCE S256 enforced, redirect `http://localhost:3000/api/auth/callback`).
  Login user `dev@coffra.local` / `dev`; its `sub` is fixed (`dde84b4e-…`), so `User.externalSubject` survives recreation.
- Keycloak keeps **no state** (embedded H2, no volume). `docker/keycloak/coffra-realm.json` is the single source of truth,
  imported on container creation only. After editing it: `docker compose -f docker/docker-compose.yaml up -d --force-recreate keycloak`
  (a plain `restart` keeps the already imported realm).
- To capture changes made in the admin console: `docker compose -f docker/docker-compose.yaml exec keycloak /opt/keycloak/bin/kc.sh export --realm coffra --file /tmp/r.json`,
  `docker compose … cp keycloak:/tmp/r.json …`, then prettier-format and commit.
- `iss` must equal `OIDC_ISSUER_URL` exactly (`KC_HOSTNAME` is pinned to `http://localhost:8080`). The app runs on the host, not in a container.
- A real IdP (homelab Keycloak) only needs the `OIDC_*` env vars changed plus an equivalent client (confidential, PKCE S256, matching redirect URI).

## Prisma 7 (optional)

- Scaffold with `turbo gen app-nest` and answer "yes" to Prisma. That adds:
  - `prisma`, `@prisma/client`, `@prisma/adapter-pg` (deps)
  - `prisma/schema.prisma` (v7: datasource has **no** `url`)
  - `prisma.config.ts` (connection URL for Migrate, from `DATABASE_URL`)
  - `src/modules/prisma/{prisma.module,prisma.service}.ts` (global module; service wires
    the `pg` driver adapter into `PrismaClient`)
  - `postinstall: prisma generate` → client generated to `src/modules/prisma/generated`
- v7 specifics: the schema no longer carries the connection URL. Migrate reads it from
  `prisma.config.ts`; the runtime client gets it via the **driver adapter**
  (`new PrismaPg({ connectionString: process.env.DATABASE_URL })`), not the schema.
- Set `DATABASE_URL` in `.env` (see `.env.example`). After schema changes:
  `pnpm prisma:generate`; migrate with `pnpm prisma:migrate`.
- The generated client (`src/modules/prisma/generated`) is git/eslint-ignored. Inject
  `PrismaService` into your services via DI (the module is `@Global`).

## Don't touch

- Generated: `build/`, `src/modules/prisma/generated`, `*.generated.*`.
- This app ships from `templates/app-nest`; edit conventions there so they propagate.
