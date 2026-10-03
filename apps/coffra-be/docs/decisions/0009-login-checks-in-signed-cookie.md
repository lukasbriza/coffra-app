# 0009 – OIDC login checks in a short-lived signed cookie

- **Status:** Accepted
- **Date:** 2026-10-03
- **Milestone / task:** M1, #12 (T9)

## Context

`AuthProviderInterface` is stateless (T7): `login()` returns the `state`, `nonce` and PKCE `codeVerifier` the callback has to verify, and keeps nothing itself. Between the redirect to the identity provider and the callback somebody has to hold them. ADR [0006](./0006-stateless-jwt-session.md) deliberately has no session table.

The holder must also bind the login to the browser that started it. If the callback only needed a value the server remembers by `state`, an attacker could start a login, then trick a victim's browser into opening the callback URL with the attacker's code (login CSRF) and the victim would be signed in as the attacker.

## Decision

`login` puts the checks into a JWT and sends it in a cookie. The callback reads the cookie and passes the checks to the provider.

- Signed (HS256) with its own secret, `AUTH_CHECKS_SECRET` (min. 32 characters, env validation requires it to differ from both JWT secrets), and expires after 10 minutes (`AUTH_CHECKS_TTL_SECONDS`). `AuthChecksService` signs and verifies with a fixed algorithm.
- Cookie `coffra_oidc_checks`: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/api/auth`, `Max-Age` equal to the token lifetime.
- Single-use: the cookie is cleared on every callback, whether it succeeds or not. `Cache-Control: no-store` on both routes.
- Rejected cookie (missing, forged, expired, wrong shape) is `401 Login session missing or expired`. The user is only created or updated after the cookie, the code exchange and the email are all in place.
- Env validation also requires `https:` for `OIDC_REDIRECT_URI` in production, as it does for the issuer, because a `Secure` cookie does not work over an `http:` callback.

## Alternatives considered

- **Server-side map keyed by `state`** (memory) – no secret, but nothing ties it to the browser, so it does not stop login CSRF, and it breaks on restart and with more than one replica.
- **Session table in Postgres** – binds well only together with a cookie anyway, adds a table and cleanup, and contradicts the stateless direction of 0006.
- **Reusing `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` with an `aud` claim** – saves one variable, but then one missing `aud` check in the guard turns this cookie into an access token. 0006 separates the secrets to rule out exactly that confusion.
- **Deriving a key from a JWT secret (HKDF)** – no new variable, but hand-written key handling and a hidden coupling to T10's secrets.
- **Encrypted cookie** – hides the verifier from the user's own browser, which gains nothing: the cookie is `HttpOnly` and only ever held by the browser that started the login. Custom crypto is not worth it.
- **`express-session` / `cookie-session`** – a new library with its own store or secret handling for a value that lives ten minutes.

## Consequences

- One more required secret in every environment. Rotating it only invalidates logins in progress.
- `SameSite=Lax` is required, not a preference: the callback is a cross-site top-level navigation from the identity provider, `Strict` would drop the cookie.
- Two login tabs at once: the second `login` overwrites the cookie and the first tab's callback fails with 401. Accepted for the single-user MVP.
- The token is signed, not encrypted: anyone holding the cookie can read the verifier, which is only the browser that started the login.
- Ten minutes cover typing a password. A longer flow at the identity provider (MFA, password reset) would expire and has to start again.
- The callback route must stay `/api/auth/callback` (redirect URI at the identity provider). A controller test pins it.
