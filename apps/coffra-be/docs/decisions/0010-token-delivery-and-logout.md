# 0010 – Token delivery, fixed refresh expiry and logout through the IdP

- **Status:** Accepted
- **Date:** 2026-10-03
- **Milestone / task:** M1, #13 (T10)

## Context

ADR [0006](./0006-stateless-jwt-session.md) chose a stateless own access and refresh JWT but left three things open: how the tokens reach the client, how far a refresh may stretch a session, and what logout means when the server keeps no session.

There is no frontend yet. The clients are Swagger, scripts and, later, a web app and a mobile app (React Native). The login itself is a browser navigation, so the Keycloak SSO session outlives anything the app does with its own tokens.

## Decision

- **Tokens travel in the JSON response body** of `GET /api/auth/callback` and `POST /api/auth/refresh`: `{ accessToken, refreshToken, expiresIn }` (`expiresIn` is the access lifetime in seconds), `Cache-Control: no-store`. The access token goes back in `Authorization: Bearer`, the refresh token only in the body of `POST /api/auth/refresh` (`{ refreshToken }`). No cookie carries a session token.
- **Claims are `sub` (the `User.id`), `iat`, `exp` and nothing else.** No email, no roles: the email is rewritten on every login and authorization lives in our DB (0006). HS256 is pinned on signing and verifying, `exp` is required, `sub` must be a non-empty string. Access and refresh tokens keep their own secrets, so neither is accepted as the other, nor is the login checks cookie (0009).
- **The refresh token ends at a fixed time.** A refresh issues a new pair whose refresh token inherits the `exp` of the one it replaces, so `JWT_REFRESH_TTL_SECONDS` is the longest session counted from the login. A refresh also looks the `User` up and answers 401 when it is gone.
- **Logout goes through the IdP.** `POST /api/auth/logout` needs no token and changes nothing on the server. It returns `{ endSessionUrl }`, the Keycloak end-session URL, or `null` when the IdP does not advertise an `end_session_endpoint`. The client discards both tokens and navigates the browser to the URL. The URL carries only `client_id`: no `id_token_hint` (the ID token is not kept, 0006) and no `post_logout_redirect_uri` (there is no frontend to return to).

## Alternatives considered

- **Refresh token in an `HttpOnly` cookie** – better for a browser, but the callback would hand out two things through two channels, `POST /refresh` would need CSRF protection, and the mobile app cannot use it. Revisit when a web frontend exists.
- **Sliding refresh expiry** (every refresh gets a full lifetime) – a few lines simpler, but a session never ends while somebody keeps refreshing it, and that includes a thief holding a stolen token.
- **No user lookup on refresh** – saves one indexed query per access lifetime, but then nothing on the server can end a session: a deleted `User` would keep getting tokens until the refresh token expires.
- **Stateless `204` logout, IdP untouched** – nothing to build, but the Keycloak SSO session survives, so the next `GET /api/auth/login` signs the user in again without a password and a logout changes nothing the user can see.
- **`GET /api/auth/logout` answering `302` to the IdP** – a plain link or image on any page could log the user out, and it suits a browser app, not an API client that keeps its tokens in JavaScript. A `POST` returning the URL leaves the navigation to the client.
- **Keeping the ID token for `id_token_hint`** (inside the refresh token or in a table) – it would skip Keycloak's confirmation page, but it needs storage or much larger tokens and contradicts the stateless direction of 0006.
- **`prompt=login` on every login** – asks for the password even right after a fresh sign-in and still leaves the SSO session open.

## Consequences

- The client has to do two things on logout, or the session at the IdP survives: drop the tokens and navigate to `endSessionUrl`. Swagger and the PR describe it.
- A refresh token still cannot be revoked and a refresh does not invalidate the old one ("rotation" is formal, there is no reuse detection without state). The only levers are deleting the `User` and rotating `JWT_REFRESH_SECRET`, which ends every session.
- Without `id_token_hint` Keycloak asks the user to confirm the logout, and without `post_logout_redirect_uri` the user stays on a Keycloak page. A web frontend adds an optional `OIDC_POST_LOGOUT_REDIRECT_URI`, registers it as `post.logout.redirect.uris` on the client and may decide about `id_token_hint` then.
- A web frontend that keeps the tokens in JavaScript exposes the refresh token to XSS. That is the point to revisit the cookie variant, in a new decision.
- The access token may outlive the end of the session by up to `JWT_ACCESS_TTL_SECONDS` (a refresh just before the end still issues a full access lifetime).
- Changing a TTL in the config only affects tokens issued afterwards.
- `refresh` and `logout` carry no access token, so T11 marks both `@Public()` next to login and callback.
