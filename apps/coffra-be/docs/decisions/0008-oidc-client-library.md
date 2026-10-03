# 0008 – `openid-client` v6 as the OIDC client, `require(esm)` on Node >= 22.12

- **Status:** Accepted
- **Date:** 2026-10-03
- **Milestone / task:** M1, #9 (T6); implemented in #10 (T7)

## Context

`OidcAuthProvider` needs discovery, an authorization URL with PKCE, `state` and `nonce`, the code exchange and `id_token` validation. ADR [0007](./0007-commonjs-and-esm-only-deps.md) left the library open because `openid-client` v6 (and its dependencies `oauth4webapi` and `jose` 6) are ESM-only and the app is CommonJS.

A spike against the dev Keycloak (Node 22.22, `openid-client` 6.8.8, TypeScript 5.9.3) showed:

- With the shared `@lukasbriza/ts-config/nestjs` (`module: node16`) a static `import … from 'openid-client'` fails typecheck with **TS1479**. `module: nodenext` fails the same way. **`module: node20`** (TypeScript >= 5.9) accepts it and tsc emits a plain `require("openid-client")`.
- At runtime Node's `require(esm)` loads the package: `nest build` + `node build/main` boot, `/api/health` is 200, no `ExperimentalWarning`, no `ERR_REQUIRE_ESM`.
- Vitest imports it natively, `vi.mock('openid-client')` and `Test.createTestingModule` work.
- Against Keycloak the full flow works: discovery, authorization URL with S256 PKCE + `state` + `nonce`, `authorizationCodeGrant` with `client_secret_post`, `tokens.claims()` (`iss` equals `OIDC_ISSUER_URL`, `sub` is the fixed dev UUID, `email`) and `fetchUserInfo`. A wrong `state`, wrong `nonce`, wrong `code_verifier` and a reused code are all rejected.
- Against a plain `http://` issuer (dev Keycloak) the library refuses by default (`OAUTH_HTTP_REQUEST_FORBIDDEN`). It needs `execute: [client.allowInsecureRequests]` in `discovery`. ESLint flags that export with `@typescript-eslint/no-deprecated` on purpose (it is marked deprecated only to stand out).

## Decision

Use **`openid-client` 6.x**, pinned to an exact version (no `^`, like the other dependencies).

- The app's `tsconfig.json` sets `"module": "node20"` so a static import compiles to `require()`. This is part of T7.
- Node >= 22.12 is required (already the root `engines`). The Docker base image in T22 must satisfy it.
- `allowInsecureRequests` is used only when the issuer URL is `http:` **and** `NODE_ENV` is not `production`. A production start with an `http:` issuer must fail instead of silently allowing it. The lint suppression carries a comment pointing to this record.
- Client authentication is `client_secret_post` (the default for a string secret), no realm change needed.

## Alternatives considered

- **Dynamic `await import('openid-client')` under `module: node16`** – would avoid touching the tsconfig, but every use becomes async-loaded and the types have to be threaded through. Not tested, kept as the fallback if `module: node20` ever causes trouble.
- **`jose` 5.x (CommonJS) + hand-written code exchange** – no ESM problem, but PKCE, `state`/`nonce` handling and the `iss`/`aud`/`nonce` checks would be our own security-sensitive code. Not needed once `openid-client` worked.
- **Switching the app to ESM** – see 0007, not pursued.

## Consequences

- `module: node20` lives in the app's tsconfig only. The same change belongs in the shared `@lukasbriza/ts-config/nestjs` and `templates/app-nest` so that scaffolded apps inherit it. That is a separate decision outside T6.
- A new ESM-only dependency now compiles without special handling, but the Node >= 22.12 floor becomes load-bearing: running on an older Node breaks at start, not at build.
- `OAUTH_INVALID_RESPONSE` is what a `state` mismatch looks like. Callback errors must be mapped to 401/400, not leaked from the library.
- An authorization code is single-use, so e2e tests with a mocked IdP (T12) cannot replay a recorded callback.
