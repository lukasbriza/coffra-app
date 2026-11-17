# Coffra API (`@lukasbriza/coffra-be`)

The backend of Coffra, a personal income and expense tracker: a REST API (NestJS 11, Prisma 7, Postgres) for
accounts, categories, transactions, transfers between your own accounts, account balances and a dashboard of
income and expense per category and month, every figure per currency. People sign in through an external OpenID
Connect provider (Keycloak); each user sees only their own data.

What it does **not** do: no frontend (the web and mobile apps use the typed client `@lukasbriza/coffra-api`), no bank
sync, no currency conversion, no investments, no shared workspaces, no user management of its own (the identity
provider does that).

Developer and agent notes live in [CLAUDE.md](./CLAUDE.md), the reasons behind the design in
[docs/decisions/](./docs/decisions/README.md). This file is about running it. The deployment to Kubernetes (the Helm
chart in [`k8s/chart/`](./k8s/chart/)) is described in CLAUDE.md, section "Deployment (k8s)".

## Contents

- [Requirements](#requirements)
- [Run it locally](#run-it-locally)
- [Dev services](#dev-services)
- [Scripts](#scripts)
- [Tests](#tests)
- [API contract](#api-contract)
- [Configuration](#configuration)
- [Production checklist](#production-checklist)
- [Identity provider](#identity-provider)
- [Sessions, secrets and account deletion](#sessions-secrets-and-account-deletion)

## Requirements

- Node **22.12 or newer** (`.nvmrc`) and pnpm **9.4** through corepack (`corepack enable`).
- Docker with Compose v2, for Postgres, Redis and Keycloak.
- Free local ports `3000` (the API), `5439` (Postgres), `6389` (Redis) and `8080` (Keycloak).

## Run it locally

From the repository root:

```bash
corepack enable
pnpm install              # also generates the Prisma client
```

Then in `apps/coffra-be`:

```bash
cp .env.example .env      # works as it is with the dev services below
pnpm infra:up             # Postgres, Redis and Keycloak; waits until they are healthy (Keycloak ~30 s)
pnpm prisma:deploy        # applies the migrations to the dev database
pnpm dev                  # the API on http://localhost:3000, restarts on changes
```

Optional demo data, in a second terminal:

```bash
pnpm db:seed
```

`db:seed` writes 12 months of accounts, categories and transactions for the dev user. It **replaces everything that
user owns**, also what you entered by hand; other users are not touched. It refuses to run with
`NODE_ENV=production`.

**Sign in.** Open <http://localhost:3000/api/auth/login> in a browser and log in as `dev@coffra.local` / `dev`. The
browser ends on the callback, which answers with JSON: `{ "accessToken": "…", "refreshToken": "…", "expiresIn": 900 }`.
Open <http://localhost:3000/api/swagger>, click **Authorize** and paste the access token. It lasts 15 minutes;
`POST /api/auth/refresh` with the refresh token gives a new pair.

Check that everything is up: `GET http://localhost:3000/api/health` answers `200` with `database` and `redis` up.

`pnpm infra:down` stops the services; the database stays on the volume `coffra-pgdata`. **Never run
`docker compose down -v`**: it deletes that volume.

## Dev services

`docker/docker-compose.yaml`, ports bound to `127.0.0.1` only. **Dev only: every password here is public.**

| Service  | Address                 | Access                                                                                                                            | Data                                                         |
| -------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Postgres | `localhost:5439`        | user and password `coffra`, database `coffra_dev`                                                                                 | volume `coffra-pgdata`                                       |
| Redis    | `localhost:6389`        | no password                                                                                                                       | nothing on disk                                              |
| Keycloak | `http://localhost:8080` | admin console `admin` / `admin`; realm `coffra`, client `coffra-be` (secret `coffra-dev-secret`), user `dev@coffra.local` / `dev` | none; the realm file is imported on every container creation |

The realm is `docker/keycloak/coffra-realm.json`. After you change it, recreate the container:
`docker compose -f docker/docker-compose.yaml up -d --force-recreate keycloak`.

## Scripts

Run in `apps/coffra-be`.

| Script                                        | What it does                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                    | Starts the API in watch mode with `NODE_ENV=development` and `.env`.                                    |
| `pnpm build` / `pnpm start`                   | Compiles to `build/` / starts it with `NODE_ENV=production` (needs an `https` issuer and redirect URI). |
| `pnpm infra:up` / `infra:down` / `infra:logs` | The dev services.                                                                                       |
| `pnpm prisma:deploy`                          | Applies the migrations to `DATABASE_URL`.                                                               |
| `pnpm prisma:migrate`                         | Creates a new migration after a change of `prisma/schema/` (development only).                          |
| `pnpm prisma:studio`                          | Prisma Studio on the dev database.                                                                      |
| `pnpm db:seed`                                | Demo data for the dev user (see above).                                                                 |
| `pnpm openapi:export --out <file>`            | Writes the OpenAPI document (see [API contract](#api-contract)).                                        |
| `pnpm image:build`                            | Builds the container image `coffra-be:local` (needs network access).                                    |
| `pnpm lint` / `pnpm ts` / `pnpm format`       | ESLint, the type check, Prettier.                                                                       |

## Tests

| Command                 | Covers                                                                                                                                                                                                                         | Needs                                  | Time       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ---------- |
| `pnpm test`             | Unit specs and the e2e specs of the login against a fake OpenID provider, in memory.                                                                                                                                           | nothing (no Docker, no `.env`)         | ~1 min     |
| `pnpm test:integration` | The real app against a throwaway database `coffra_test` on the dev Postgres and the dev Redis: isolation between users, transfers, dates, balances, the dashboard against independent SQL, the main flow from login to logout. | `pnpm infra:up`                        | ~1.5–2 min |
| `pnpm test:image`       | The built image: migrations, start, health check, refused configuration, shutdown, Redis outage.                                                                                                                               | `pnpm image:build` and `pnpm infra:up` | ~1 min     |
| `pnpm test:cov`         | `pnpm test` with coverage.                                                                                                                                                                                                     | nothing                                | ~2–3 min   |

`pnpm test:unit` and `pnpm test:e2e` run one half of `pnpm test`. CI (`.github/workflows/ci.yml`) runs all three
suites on every pull request.

## API contract

`pnpm openapi:export --out <file>` writes the OpenAPI document of the API, the one the Swagger UI shows, in about five
seconds. It needs no database, no Redis and no `.env`, and it describes the production API whether or not
`SWAGGER_ENABLED` is on.

The frontends do not call it: they use `@lukasbriza/coffra-api` (`packages/coffra-api`), where the document is
committed as `src/schema.json` with the types generated from it. After a change of a controller or a DTO run
`pnpm --filter @lukasbriza/coffra-api api-schema:update` and commit both schemas; `pnpm test` fails until you do.

## Configuration

Everything comes from the environment, checked at startup: a missing or invalid variable stops the start with one
line per problem, never with the value. `.env.example` lists every variable with its dev value.

| Variable                  | Required | Default                                  | Example                                                       | Meaning                                                                                                                                                                                         |
| ------------------------- | -------- | ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                | no       | `development`                            | `production`                                                  | `development`, `production` or `test`. `production` requires `https` for the issuer and the redirect URI and turns Swagger off by default. The image sets it.                                   |
| `PORT`                    | no       | `3000`                                   | `3000`                                                        | Port of the HTTP server, 1–65535. The image sets it.                                                                                                                                            |
| `DATABASE_URL`            | yes      | –                                        | `postgresql://coffra:<password>@db:5432/coffra?schema=public` | Postgres connection string (`postgres://` or `postgresql://`). Characters such as `@ : / #` in the password must be URL-encoded.                                                                |
| `OIDC_ISSUER_URL`         | yes      | –                                        | `https://auth.example.com/realms/coffra`                      | Issuer of the identity provider. Must equal the `issuer` of its discovery document exactly. `https` in production.                                                                              |
| `OIDC_CLIENT_ID`          | yes      | –                                        | `coffra-be`                                                   | Client ID at the identity provider.                                                                                                                                                             |
| `OIDC_CLIENT_SECRET`      | yes      | –                                        | (from the provider)                                           | Secret of that confidential client.                                                                                                                                                             |
| `OIDC_REDIRECT_URI`       | yes      | –                                        | `https://coffra.example.com/api/auth/callback`                | The callback registered at the provider; the path is always `/api/auth/callback`. `https` in production.                                                                                        |
| `JWT_ACCESS_SECRET`       | yes      | –                                        | 64 random characters                                          | Signs the access tokens. At least 32 characters, different from the other two secrets.                                                                                                          |
| `JWT_REFRESH_SECRET`      | yes      | –                                        | 64 random characters                                          | Signs the refresh tokens. At least 32 characters, different from the other two secrets.                                                                                                         |
| `AUTH_CHECKS_SECRET`      | yes      | –                                        | 64 random characters                                          | Signs the short-lived cookie that carries the login checks (state, nonce, PKCE verifier) from the login to the callback. At least 32 characters, different from both JWT secrets.               |
| `JWT_ACCESS_TTL_SECONDS`  | no       | `900`                                    | `900`                                                         | Lifetime of an access token in seconds.                                                                                                                                                         |
| `JWT_REFRESH_TTL_SECONDS` | no       | `2592000`                                | `2592000`                                                     | The longest session from the login, in seconds (30 days). A refresh keeps the end of the original session.                                                                                      |
| `CORS_ORIGINS`            | no       | empty                                    | `https://app.example.com,http://localhost:5173`               | Browser origins allowed to call the API, comma separated, each exactly as the browser sends it (no path, no trailing slash, no default port, no `*`). Empty: no CORS headers at all.            |
| `TRUST_PROXY_HOPS`        | no       | `0`                                      | `1`                                                           | Number of reverse proxies in front of the app, 0–10. Decides the client address the rate limit counts (see [Production checklist](#production-checklist)).                                      |
| `RATE_LIMIT_TTL_SECONDS`  | no       | `60`                                     | `60`                                                          | The window of the rate limit, in seconds.                                                                                                                                                       |
| `RATE_LIMIT_MAX`          | no       | `120`                                    | `120`                                                         | Requests one client address may send per window to every route but the login ones. Past it: `429` with `Retry-After`.                                                                           |
| `RATE_LIMIT_AUTH_MAX`     | no       | `10`                                     | `10`                                                          | Requests one client address may send per window to the login routes together (login, callback, refresh, logout).                                                                                |
| `REDIS_URL`               | yes      | –                                        | `redis://localhost:6389`                                      | Redis that keeps the rate limit counters (`redis://` or `rediss://` for TLS; a password goes into the URL). While it does not answer, counted requests are `503` and `/api/health` reports it.  |
| `SWAGGER_ENABLED`         | no       | on outside production, off in production | `false`                                                       | `true` or `false`: whether the Swagger UI (`/api/swagger`) and the document (`/api/swagger-json`) are served. Swagger runs outside the guards and the rate limit, so keep it off in production. |

**Generate a secret** (each one separately, never reuse one):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**An empty value is not "not set" for a number:** `PORT=`, `RATE_LIMIT_MAX=` or `JWT_ACCESS_TTL_SECONDS=` stops the
start. Leave such a variable out instead. An empty `CORS_ORIGINS`, `TRUST_PROXY_HOPS` or `SWAGGER_ENABLED` is fine.

## Production checklist

- **`https` everywhere:** `OIDC_ISSUER_URL` and `OIDC_REDIRECT_URI` must be `https`, or the app does not start. TLS
  ends at the reverse proxy in front of the app; the login cookie is `Secure`.
- **`TRUST_PROXY_HOPS` must match the real number of proxies** in front of the app (`1` behind one reverse proxy).
  Too low, and every client looks like the proxy and shares one rate limit. Too high, and a client writes its own
  address into `X-Forwarded-For` and escapes the limit. Check it from two networks: their `X-RateLimit-Remaining`
  must differ.
- **CORS:** not needed while the frontend is on the same host. A frontend on another origin needs `CORS_ORIGINS`.
- **Rate limit:** 120 requests per minute and client address, 10 for the login routes together; the counters are in
  Redis, so they hold across restarts and replicas. While Redis is down, counted requests are `503`.
- **Health:** `GET /api/health` is public and outside the rate limit; it answers `200` when Postgres and Redis answer
  and `503` when one does not. Use it for readiness, not for liveness: a database outage would restart the app in a
  loop.
- **Migrations** never run on start: apply them with `prisma migrate deploy` (`pnpm prisma:deploy`, or the second
  command of the image) before the new version starts.
- **Swagger** stays off in production (`SWAGGER_ENABLED` unset).

## Identity provider

Any OpenID Connect provider works; these are the steps in Keycloak. In the realm the app should use:

1. **Clients → Create client:** type `OpenID Connect`, Client ID `coffra-be` (= `OIDC_CLIENT_ID`).
2. **Capability config:** Client authentication **on** (confidential), Authorization off; only **Standard flow**
   (switch off Direct access grants, Implicit flow, Service accounts, Device and CIBA grants); PKCE method **S256**
   (or later under Advanced → Advanced settings → Proof Key for Code Exchange Code Challenge Method).
3. **Login settings:** Valid redirect URIs exactly `https://<host>/api/auth/callback`; Web origins and post logout
   redirect URIs empty.
4. **Credentials:** the client secret is `OIDC_CLIENT_SECRET`.
5. **Realm settings → Login → User registration: off.** The first login of any identity the provider confirms creates
   a user in the app; the app has no allow-list of its own. Before you move the app to a realm where registration is
   on, restrict the client to a role (a browser flow of the client that denies users without it), or keep it in a
   realm of its own.
6. Every user needs an **email** in the provider (the app asks for `openid email profile`; without an email the login
   is `401`).

`OIDC_ISSUER_URL` is `https://<provider>/realms/<realm name>` and must match the `issuer` of
`/.well-known/openid-configuration` character for character, without a trailing slash.

**The user is identified by the `sub` of the provider, not by the email.** A recreated realm, a user created again, or
a move to another realm gives new `sub` values, and the next login creates a new, empty user; the old data stays under
the old one.

## Sessions, secrets and account deletion

**Sessions.** After the login the app issues its own tokens: an access token for 15 minutes and a refresh token. A
refresh issues a new pair but keeps the end of the session: 30 days after the login, a new login is needed.
`POST /api/auth/logout` changes nothing on the server and returns `endSessionUrl`; the client drops its tokens and sends
the browser there to end the session at the provider too.

**Rotating a secret.** Change the variable and restart the app: a running process keeps the environment it started
with.

| Secret               | What a change does                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `JWT_ACCESS_SECRET`  | Every access token is refused (`401`); clients get a new one with their refresh token.                 |
| `JWT_REFRESH_SECRET` | Ends every session: refresh tokens are refused, access tokens still work until they expire (≤ 15 min). |
| `AUTH_CHECKS_SECRET` | Only logins in progress (between the login and the callback, at most 10 minutes) fail.                 |
| `OIDC_CLIENT_SECRET` | Change it at the provider and in the app at the same time; until both match, logins fail.              |

**Deleting an account.** A signed-in user deletes their own account with `POST /api/users/me/deletion` and
`{ "confirm": "<their email>" }`: every account, category and transaction and the user itself go in one database
transaction, **with no undo** apart from a backup. The identity at the provider stays: the client should log out at the
provider afterwards, otherwise the next login signs the same person into a new, empty account. To lock someone out,
disable them at the provider.
