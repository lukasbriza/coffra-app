# 0011 – Global default-deny JWT guard, `@Public()` as the opt-out

- **Status:** Accepted
- **Date:** 2026-10-04
- **Milestone / task:** M1, #14 (T11)

## Context

ADR [0006](./0006-stateless-jwt-session.md) and [0010](./0010-token-delivery-and-logout.md) settled how the session tokens are issued. Nothing yet decided how a request proves itself on every other route, and the app is about to grow many (accounts, categories, transactions, dashboard), each of which must be reachable by its owner only. The question is where the default lies: routes open until someone protects them, or closed until someone opens them.

## Decision

- **A global guard denies by default.** `JwtAuthGuard` is made global in `main.ts` with `app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector), app.get(AuthTokensService)))`, so it covers every module. It is built by hand and is no provider: a provider by itself guards nothing, and nothing else needs to inject it. The `core` barrel exports the guard and `AuthTokensService` for `main.ts`. A route needs a valid access token (`Authorization: Bearer`, checked by `AuthTokensService.verifyAccess`, never `verifyRefresh`) unless it is marked `@Public()`. The public surface today is `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/refresh`, `POST /api/auth/logout` and `GET /api/health`.
- **`@Public()` is explicit and as narrow as it can be.** On `AuthController` it sits on each method, not on the class, so a route added there later stays protected until someone opens it on purpose. `HealthController` is public as a whole (Docker and k3s probes). A public route does not even read the `Authorization` header: refresh and logout must work for a client whose access token has expired.
- **The guard checks the token and nothing else.** No database lookup: signature, `exp` and claims only, in line with 0006. `request.auth` carries `{ userId }` and `@CurrentUser()` hands out that id, nothing more.
- **Every rejection is the same `401`** (`Invalid or expired access token`, whatever the reason, the reason only reaches the log) with `WWW-Authenticate: Bearer` (RFC 6750). Only the guard sets that header, so it also tells a guard rejection from a `401` a route answered itself (the callback without its cookie).
- **Swagger follows the same default.** The document carries a global `bearer` requirement and `@Public()` overrides it on the operation with an empty one (`@ApiSecurity({})`), so one decorator is the single source of truth for both the guard and the docs.
- **`GET /api/users/me`** is the first protected route and the first consumer of `@CurrentUser()`: `{ id, email }` of the token's user, `401` when that user no longer exists.

## Alternatives considered

- **Opt-in `@UseGuards(JwtAuthGuard)` per controller** – a controller or route someone forgets to guard is silently open. Default-deny fails closed: a forgotten `@Public()` is a visible `401`.
- **`APP_GUARD` provider in `AuthModule`** – also global and keeps the guard in every app that boots the module, but the global effect hides in a providers list and cannot be seen at bootstrap. `app.useGlobalGuards` in `main.ts` says plainly what the app does.
- **`useGlobalGuards(app.get(JwtAuthGuard))` with the guard as a provider** – the same line, but the guard would sit in `AuthModule` only to be fetched back by `main.ts`. Building it by hand needs no provider, no `@Injectable()` and no `@Inject()`.
- **`useGlobalGuards` inside `configureApp`** – would make tests and `main.ts` boot identically, but every test module that uses `configureApp` would then have to provide the guard and its dependencies.
- **A path allow-list inside the guard** – keeps the public routes in one file, but detaches them from the routes themselves and breaks with a prefix or path change, and the Swagger document could not follow it.
- **A database lookup on every request** – would end a deleted user's session at once, but adds a query per request and makes the access token stateful, against 0006. The refresh path and `/me` already look the user up.
- **`passport-jwt` / `@nestjs/passport`** – two more dependencies for roughly thirty lines the guard needs, with `@nestjs/jwt` already in place.
- **`@Public()` on the whole `AuthController`** – shorter, but then every route added there is public by accident.

## Consequences

- **The guard exists only where it is switched on.** An app booted without the `useGlobalGuards` line, e.g. a test module that calls only `configureApp` or a future e2e suite, has no authentication. Nothing tests `main.ts` itself: keep the line next to `configureApp`, and make every e2e bootstrap repeat it and assert a `401` on a protected route.
- A new public route has to be marked on purpose. `test/modules/core/public-routes.spec.ts` pins the exact list of public routes, so an accidental one fails the build.
- The access token of a deleted user stays valid for up to `JWT_ACCESS_TTL_SECONDS` (15 minutes). Routes that read or write data catch it through the ownership layer (T13); `/me` and the refresh already do.
- Infrastructure now imports a domain once: `health` imports `Public` from the `core` barrel. It is the one exception to "infrastructure imports no domain", documented in `CLAUDE.md`.
- Guard rejections log one `warn` line each (from `AuthTokensService`), so unauthenticated traffic shows up in the log. There is no rate limit; that waits until the API is exposed beyond the home network.
- The generated OpenAPI document (T26) carries the global `security`, so a client generated from it sends the bearer token on every operation except the public ones.
- Swagger UI and `swagger-json` are served outside the Nest pipeline and stay open. The spec is not a secret.
- Unknown paths still answer `404`: the guard only runs on routes that exist.
