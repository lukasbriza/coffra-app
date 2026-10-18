# CLAUDE.md — NestJS app

Per-app context. Inherits monorepo conventions from the root `CLAUDE.md`; this file
covers only what is specific to a NestJS app.

## Stack

- NestJS 11 (Express 5 platform), TypeScript (CommonJS output via `nest build` → `build/`).
- Swagger at `/api/swagger` (`@nestjs/swagger`), config via `@nestjs/config` + dotenv.
- Validation: `class-validator`. Tests: **vitest** (`vitest.config.mjs`).

## Layout

- `src/main.ts` — bootstrap (Nest factory, port from `ConfigService`).
- `src/app.setup.ts` — `configureApp(app)`: global prefix `api`, `cookie-parser`, `ValidationPipe`, shutdown hooks. Shared with tests.
- `src/swagger.setup.ts` — `buildSwaggerDocument` / `setupSwagger` (bearer auth as a global requirement that `@Public()` clears per operation, UI at `/api/swagger`).
- `src/modules/health/` — `GET /api/health` (`@nestjs/terminus`, DB check via `PrismaHealthIndicator`).
- `src/app.module.ts` — root module; register domain modules here (imported from their `index.ts`).
- Domains in `src/modules/{core,transactions,dashboard}/` (module + controller + service + dto, grouped in subfolders).
- `src/modules/core/auth/` — `AuthModule`: `AuthProviderInterface` port (`AUTH_PROVIDER` token) and `OidcAuthProvider` (`openid-client`). The domain barrel exports the token, the types, `@Public()` / `@CurrentUser()` and, for `main.ts` only, `JwtAuthGuard` and `AuthTokensService`: inject `@Inject(AUTH_PROVIDER)`, never the provider class.
  - Login flow: `AuthController` (`GET /api/auth/login` → 302 to the IdP, `GET /api/auth/callback`) is HTTP only; `AuthService` ties the provider and `UsersService` together and touches the user last; `AuthChecksService` signs/verifies the cookie `coffra_oidc_checks` that carries `state`, `nonce` and the PKCE verifier between the two requests (signed with `AUTH_CHECKS_SECRET`, 10 min, single-use, `SameSite=Lax`; ADR 0009). The callback path is the redirect URI registered at the IdP: do not move it.
  - Session (ADR 0006, 0010): after the callback `AuthTokensService` (`core/auth/auth-tokens.service.ts`) issues the app's own access and refresh JWT, returned in the response body (`{ accessToken, refreshToken, expiresIn }`, `no-store`). Claims are only `sub` (`User.id`), `iat`, `exp`; each token has its own secret and HS256 is pinned. `POST /api/auth/refresh` (`{ refreshToken }`) checks that the user still exists and issues a new pair whose refresh token **inherits the old `exp`** (`JWT_REFRESH_TTL_SECONDS` = longest session from the login). `POST /api/auth/logout` changes nothing on the server and returns `{ endSessionUrl }` for the IdP session: the client drops the tokens and navigates the browser there. `verifyAccess` is for the guard, never `verifyRefresh`.
  - Access control (ADR 0011): `JwtAuthGuard` (`core/auth/jwt-auth.guard.ts`) is made global in `main.ts` (`app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector), app.get(AuthTokensService)))`: built by hand, no provider, so the `core` barrel exports the guard and `AuthTokensService` for it) and **denies by default**: every route needs `Authorization: Bearer <access token>` unless it is `@Public()`. The guard only checks the token (signature, `exp`, claims), never the database, and sets `request.auth = { userId }`. A rejection is always `401 Invalid or expired access token` with `WWW-Authenticate: Bearer`. A public route does not read the header at all.
  - `@Public()` and `@CurrentUser()` (`core/auth/decorators/`, exported from the `core` barrel) are what other domains use: `@CurrentUser() userId: string` is the id from the token, only on routes that are not public (it throws on a public one). `@Public()` also clears the global bearer requirement of that operation in Swagger, so one decorator serves both. On `AuthController` it goes on each method, not on the class, so a route added there stays protected. The public surface is exactly `login`, `callback`, `refresh`, `logout` and `GET /api/health`; `test/modules/core/public-routes.spec.ts` pins that list, so a new public route means editing it on purpose.
  - An app booted without that `main.ts` line has no authentication (`configureApp` does not add it): a test or e2e bootstrap that needs the guard repeats that line itself.
  - A new endpoint needs nothing to be protected. Do not put `@UseGuards` or `@ApiBearerAuth()` on it: both are already global.
- `src/modules/core/users/` — `UsersModule`: `UsersService.upsertByExternalSubject` finds or creates the `User` by `(oidc, sub)` (never by email) and keeps the email in sync; `findById` serves the token refresh and `GET /api/users/me` (`UsersController`: `{ id, email }` of the token's user, 401 when it no longer exists). The service is exported to `AuthModule`, not through the domain barrel.
- `src/modules/core/ownership/` — `OwnershipModule` (ADR 0012): the one place that decides whose rows a request sees. `OwnershipService` runs no query; the domain spreads its pieces into its own Prisma calls, so a foreign row is never found and ends like a missing one (`404 <Resource> not found`, same body, never `403`). A domain module imports `OwnershipModule` from the `core` barrel, not `CoreModule` (that would boot auth), and injects `@Inject(OwnershipService)`.
  - `@CurrentOwner() owner: Owner` is for data (every route of `transactions` and `dashboard`); `@CurrentUser()` is for the identity of the caller only (`GET /api/users/me`). A domain service takes `owner: Owner`, never a `userId`, and never reads its fields: with workspaces the owner changes, the service signatures do not.
  - Usage (the review rule: **every** query on `account`, `category` and `transaction` spreads `ownership.scope(owner)`, writes included; `findUnique({ where: { id } })` in a domain is a red flag; the domain never writes `userId` into a `where` or `data` itself):

    ```ts
    this.prisma.account.findMany({ where: this.ownership.scope(owner) })
    this.ownership.orNotFound(
      await this.prisma.account.findFirst({ where: { id, ...this.ownership.scope(owner) } }),
      'Account',
    )
    this.prisma.account.create({ data: { ...fields, ...this.ownership.ownerData(owner) } })
    this.prisma.transaction.findMany({ where: { account: this.ownership.scope(owner), ...filters } }) // child model: through its parent
    ```

  - One owner per request: an account and a category are checked to belong together by reading both through the same scope.
  - `Account` and `Category` carry a nullable `tenantId` (always `NULL`, nothing writes or reads it). **Never return a Prisma row from a controller**: map it to a view type, otherwise `userId` and `tenantId` leak into the API.
  - `test/modules/core/ownership/foreign-equals-missing.spec.ts` proves the composition over HTTP; `test/modules/transactions/owner-scope.spec.ts` is a compile-time contract (`pnpm ts`) that the scope fits the `transactions` models.
- `src/modules/transactions/accounts/` — `AccountsModule` (imports `OwnershipModule`): `POST/GET/GET :id/PATCH/DELETE /api/accounts`, the reference CRUD for the rest of the domain (see CRUD conventions). `openingBalance` is a column, not a transaction; the currency is set on create only and a `PATCH` with `currency` is a 400 (ADR 0013). Deleting an account with transactions is a 409 decided by the `Restrict` of the database, not by a count beforehand.
- `src/modules/transactions/common/` — what the features of `transactions` share: `constants.ts` (`MONEY_SCALE`, `SIGNED_DECIMAL_PATTERN`, `RESOURCE_NAME_MAX_LENGTH`), `formatMoney`, `decorators/` (`@IsDecimalAmount()`, `@IsResourceName()`). Moves to `src/utils` once a second domain needs it.
- A feature inside a domain (`core/auth`, `core/users`, ...) is its own Nest module, `<feature>.module.ts`, imported by the domain module. The feature module is internal: only the domain's `index.ts` is public.
- Infrastructure modules (not domains): `src/modules/{config,health,prisma}/`, each with an `index.ts`.
- `src/utils/` — project-wide pure helpers (no Nest, no domain imports), one function per file, the file is the kebab-case of the function name (`stringOrUndefined` → `string-or-undefined.ts`, the shared ESLint enforces kebab-case filenames), all re-exported from the `index.ts` barrel and imported through it (`'../../../utils'`). Put a helper here once a second domain needs it, or when it is generic by nature.

## Module boundaries

Modular monolith: one Nest app, a domain = a module in `src/modules/<domain>/`.

1. A domain exports only through its `index.ts`. Everything else imports `'../<domain>'`, never `'../<domain>/…'`.
2. A domain touches only its own Prisma models (`prisma/schema/<domain>.prisma`). Foreign data comes through a public service of the other domain.
3. Dependency direction is `core` ← `transactions` ← `dashboard`. `core` imports no domain, `transactions` only `core`, `dashboard` `core` and `transactions`.
4. The only allowed relations between schemas are foreign keys to `User` and `tenantId`.

- **No rule is lint-enforced** (deliberately dropped): the boundaries hold by discipline and review. Inside its own domain, files import freely.
- `config`, `health` and `prisma` are infrastructure: reachable from anywhere through their `index.ts`, but they import no domain. **One exception:** `health` imports `Public` from the `core` barrel (`'../core'`) so the probes need no token (ADR 0011). `core` never imports `health`, so there is no cycle.
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

## CRUD conventions

Set by `transactions/accounts` (T14); categories, transactions and transfers follow them.

- **Layout:** `<feature>/` with `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.types.ts` (`<Model>View`, `Create<Model>Input`, `Update<Model>Input`), `<feature>.mapper.ts` (`to<Model>View`) and `dto/` (`<model>.dto.ts` for Swagger, `create-<model>.dto.ts`, `update-<model>.dto.ts`). The controller only passes `@CurrentOwner() owner: Owner` and the DTO on; the service takes `owner` and an input type (the DTO `implements` it).
- **Status codes:** `POST` `201` with the resource, `GET` `200`, `PATCH` `200` with the whole resource, `DELETE` `204` with no body (`@HttpCode(HttpStatus.NO_CONTENT)`). `400` for invalid input, including an id in the path that is not a UUID (`@Param('id', ParseUUIDPipe)` on every `:id`: any well-formed UUID goes on to the lookup, so the database never sees a malformed one). `404` for a missing **or** foreign id, only through `ownership.orNotFound`. `409` for a conflict of state (`Restrict`, a unique constraint, a domain rule). The guard answers `401` before any pipe runs.
- **Responses:** always a `<Model>View` built by the mapper in `<feature>.mapper.ts` (`toAccountView`: a pure function, no DI, listed fields only, with its own spec), never a Prisma row (`userId`, `tenantId`, timestamps stay inside). Swagger documents every response code of the operation.
- **Money:** in as a decimal string through `@IsDecimalAmount()` (a JSON number, an exponent, more than 4 decimal places or more than 15 integer digits is a `400`, so nothing overflows `Decimal(19,4)` into a `500`); out through `formatMoney` with exactly four decimal places. Prisma takes the string as it is.
- **Validation before the database:** every CHECK constraint has a DTO rule that fires first (the currency regex is the one of `currency_iso`), so a constraint is a last line of defence, never the answer to a client.
- **Names:** `@IsResourceName()` (trimmed, non-empty, at most 100 characters).
- **Optional fields and `null`:** an optional field of a create DTO uses `@ValidateIf((_dto, value) => value !== undefined)`, not `@IsOptional()` (that lets `null` through to a NOT NULL column, a `500`). The update DTO is `PartialType(CreateDto, { skipNullProperties: false })` for the same reason. `null` is accepted only for a nullable column, explicitly. A field that must not change is declared on the update DTO only to be refused (`@Equals(undefined, …)` + `@ApiHideProperty()`): the global `whitelist` would otherwise drop it silently and answer `200`.
- **Prisma `data` from optional input:** `omitUndefined({ … })` (`src/utils`), because `exactOptionalPropertyTypes` does not accept an explicit `undefined`. List the fields by name; never spread a DTO into `data`.
- **Prisma errors** are mapped in the service, where the meaning of the code for that operation is known: `isPrismaError(error, PrismaErrorCode.X)` from the `prisma` barrel (`P2003` is a `409` on deleting an account with transactions but a `401` on creating an account for a deleted user; `P2025` after a scoped read is the same `404`). Anything else is rethrown and ends as a `500` in the log. No global exception filter. With `@prisma/adapter-pg` a foreign key violation does arrive as `PrismaClientKnownRequestError` `P2003` (verified against the dev Postgres).
- **Reads before writes:** `update`/`delete` first run the scoped read (`findOwned`: `findFirst` + `orNotFound`), then write with the scope again (`where: { id, ...scope }`).
- **Lists:** a stable order (a unique tie-breaker such as `id` after the sort column).
- **Tests:** the service over a mocked Prisma and the real `OwnershipService` (pins the `where`, the `data` and the error mapping); the controller behind the real guard and `configureApp` with a mocked service (status codes, validation table with `it.each`, the owner from the token, the body cannot choose the owner). Isolation through real queries is T20.

## Conventions

- One module per feature; keep controllers thin, logic in services (DI).
- **Swagger decorators sit apart from the functional ones**, on a class and on a method alike: first what changes behaviour (`@Controller`, the route, `@HttpCode`, `@Header`, `@Redirect`, `@Public()`, `@HealthCheck()`), then a `// Swagger` comment line, then only documentation (`@ApiTags`, `@ApiOperation`, `@Api…Response`, `@ApiParam`). Everything below `// Swagger` can be removed without changing what the API does. A decorator that does both (`@Public()`) counts as functional. Nest and Swagger do not depend on the order.

  ```ts
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Swagger
  @ApiOperation({ summary: 'Delete an account that has no transactions' })
  @ApiNoContentResponse({ description: 'Deleted' })
  remove(…) {}
  ```

- DTOs validated with `class-validator`; enable a global `ValidationPipe` when adding input.
- All routes live under the `api` prefix. New endpoint tests must boot via `configureApp(app)`.
- **Ports get the `Interface` suffix** (`AuthProviderInterface`): an interface that classes implement and callers depend on. Plain data shapes (`AuthSession`, `LoginRequest`) do not.
- **Tests mirror `src/`**: module tests in `test/modules/<module>/…` (plus the feature folder when the module has one, e.g. `test/modules/core/auth/`), util tests in `test/utils/`, tests of root files (`app.setup.ts`, `swagger.setup.ts`) directly in `test/`.
- **One spec file per use case** for a controller, service or provider: a folder named after the source file (`auth.service.ts` → `test/modules/core/auth/auth.service/`) holds `<use-case>.spec.ts` in kebab-case (`complete-login.spec.ts`, `refresh.spec.ts`; a controller by endpoint: `login.spec.ts`, `callback.spec.ts`), `dependency-injection.spec.ts` for the `@Inject` check, and a `setup.ts` with the fixtures and a `use<Subject>()` function that registers the `beforeEach`/`afterEach` of the block it is called in and returns the mocks. Helpers shared by several folders sit next to them (`auth/use-quiet-warnings.ts`). A small file with one subject and one use case stays a plain `<subject>.spec.ts` (`env.validation.spec.ts`, a util). `setup.ts` and the helpers are not `*.spec.ts`, so vitest does not run them, and `eslint.config.mjs` allows devDependencies in all of `test/`.
- A spec that mocks a module (`vi.mock('openid-client', …)`) repeats the `vi.mock` call in every file: it is hoisted per file and cannot live in `setup.ts`.
- **Specs need no `.env`.** `vitest.config.mjs` (`test.env`) sets a complete dummy environment for the whole run, because importing anything from `src/modules/config` validates the environment at once. `process.env` wins over a developer's `.env`, so the run is the same on every machine and in CI. A new required variable in `env.validation.ts` needs a value there too. A spec that needs other values stubs them (`vi.stubEnv`) before the import.
- **E2E specs** live in `test/e2e/<area>/` (`test/e2e/auth/`), their shared support in `test/e2e/support/`. `useAuthApp()` (`test/e2e/auth/setup.ts`) boots the real `AppModule` against a fake OpenID provider (`FakeIdp`: `node:http` on `127.0.0.1`, random port, RS256 ID tokens signed through `@nestjs/jwt`) and an in-memory user table (`InMemoryPrisma` stands in for `PrismaService`, the real `UsersService` runs on it). The real `OidcAuthProvider` and `openid-client` run unmodified, so this is where `state`, `nonce`, PKCE, `iss` and `aud` are proven to be enforced, which the unit specs (they mock `openid-client`) only pin as arguments. No Docker, no `.env`, no fixed port. Rules for a new e2e spec:
  - Set the environment with `vi.stubEnv` and import everything that reaches `modules/config` **dynamically, afterwards** (`loadApp()`): `ConfigModule.forRoot` validates the environment when `config.module.ts` is first imported, so a static import is too early. Dynamic imports need the `.js` extension (`"module": "node20"`).
  - Every e2e bootstrap repeats the `app.useGlobalGuards(...)` line of `main.ts` and asserts a `401` on a protected route (`protected-routes.spec.ts`, ADR 0011).
  - `travel(seconds)` moves `Date` only. The fake IdP shares the process clock, so sign first and travel after; an expired ID token is made with an explicit `exp`.
  - A refusal asserts the reason in the log (`warn`), not only the status, and has a control that succeeds with the same setup: a broken fake IdP also answers `401`.
- `openid-client` does not verify the ID token signature in the code flow (the token comes straight from the token endpoint over TLS: OIDC Core 3.1.3.7 step 6). That is why an `https:` issuer is mandatory in production, and why no spec can test a forged ID token signature.
- **Type files hold types only.** A module with its own types names the file `<module>.types.ts` (`core/users/users.types.ts`); a feature folder whose types are shared by several files (`core/auth/types.ts`) uses plain `types.ts`. Runtime values that go with them (DI tokens, cookie names, metadata keys) live in `<module>.constants.ts`, or in a plain `constants.ts` when a feature folder shares them across files (`core/auth/constants.ts`).
- **Inject with `@Inject(Token)` on every constructor parameter.** Vitest (esbuild) emits no decorator metadata, so type-based injection resolves to `undefined` in `Test.createTestingModule`.
- `@nestjs/terminus` is pinned to 11.x: 12.x is ESM-only and this app is CommonJS.
- `openid-client` 6.x is ESM-only too and loads through `require(esm)`: that needs `"module": "node20"` in this app's `tsconfig.json` (otherwise TS1479) and Node >= 22.12. See ADR 0008.
- `OIDC_ISSUER_URL` over plain `http:` works outside production only (dev Keycloak). A production start with it fails env validation, so `pnpm start` (`NODE_ENV=production`) needs an `https:` issuer.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `AUTH_CHECKS_SECRET` must all differ (env validation enforces it), so one kind of signed value is never accepted as another. In production `OIDC_REDIRECT_URI` must be `https:` too (the login cookie is `Secure`).
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
