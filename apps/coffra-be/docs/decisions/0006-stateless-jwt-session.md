# 0006 – Stateless own JWT session after OIDC login

- **Status:** Accepted
- **Date:** 2026-09-29
- **Milestone / task:** decided in planning; config in M0 (#3), implementation in M1 (#13)

## Context

Authentication is delegated to an external OIDC provider (own Keycloak), single user. The session
strategy after the OIDC login was an open one-way decision in `docs/00_plan.md`.

## Decision

After exchanging the OIDC code, the backend issues its own access and refresh JWT (`@nestjs/jwt`).

- Access and refresh tokens are signed with **different secrets** (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`), so a refresh token is never accepted as an access token. Env validation requires at least 32 characters and rejects equal secrets.
- Lifetimes come from config: `JWT_ACCESS_TTL_SECONDS` (default 900), `JWT_REFRESH_TTL_SECONDS` (default 30 days).
- Authorization (roles, tenant membership) lives in our own DB, not in OIDC claims, so the app does not depend on a particular IdP more than it must.

## Alternatives considered

- **Stateful DB session + IdP refresh token** – can be revoked immediately, but needs a session table and more code.
- **Validating the IdP access token via JWKS** – least code, but makes `AuthProvider.login` thin and ties the API to IdP tokens.

## Consequences

- A stateless refresh token cannot be revoked. Accepted for the single-user MVP; logout only ends the session on the client.
- Moving to a revocable session later means adding a session store behind the same endpoints.
