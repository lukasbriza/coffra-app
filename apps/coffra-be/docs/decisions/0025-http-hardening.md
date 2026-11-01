# 0025 – HTTP hardening: headers, CORS, rate limit, proxy

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The API is about to leave the home network and run in a container behind a reverse proxy. Until now it sent no
security headers, had no CORS policy (so a browser client on another origin could not call it, and nothing said
which would be allowed) and no rate limit, while the login routes are exactly what an attacker hammers.

Constraints that shaped the choices:

- `configureApp(app)` is the one place that configures an application the same way in `main.ts` and in about
  seventeen test bootstraps; the line that makes the JWT guard global stays in `main.ts` on purpose (ADR 0011).
- The platform is Express 5 and the app is CommonJS (ADR 0007): every new dependency has to load through `require`.
- The rate limit counts a client address. Behind a proxy that address is whatever Express makes of
  `X-Forwarded-For`, and a client writes that header itself.
- `@nestjs/throttler` keys its counters by controller and method by default, so its "global" limit is a limit per
  route, and a named throttler adds its name to the answer headers (`Retry-After-auth`).
- The Swagger UI is a page served outside the Nest pipeline that loads its own scripts and styles.

## Decision

**Where.** `configureApp(app, options?)` sets `helmet` always and, from `options` (`AppOptions`, read by `main.ts`
from the environment), CORS and the number of trusted proxies; without options it behaves as the safe default, so
the tests that call `configureApp(app)` need nothing. The rate limit is an infrastructure module,
`src/modules/rate-limit/`, imported by `AppModule`. Its guard is a provider under the token `RATE_LIMIT_GUARD` and
`APP_GUARD` points at it (`useExisting`). Registered as a module provider, it runs **before** the `JwtAuthGuard` that
`main.ts` adds with `useGlobalGuards`, so requests turned away with `401` are counted too (guessing tokens is
limited). The `JwtAuthGuard` line is unchanged.

**Headers.** `helmet` with the strict policy of a service that answers with JSON only:
`default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. The rest is the default of
`helmet` (HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, no
`X-Powered-By`). Under `/api/swagger` only, `setupSwagger` replaces `Content-Security-Policy` with the default policy
of `helmet` **without `upgrade-insecure-requests`**: the page loads three scripts and two inline styles from its own
origin, which `script-src 'self'` and `style-src 'unsafe-inline'` allow, and the directive would make a browser fetch
them over `https` on the plain-`http` dev server. `/api/swagger-json` and `-yaml` keep the strict policy. A spec holds
what the page needs without a browser: no inline script, every script and style from the same origin, the files
served under the same header. Anything the UI turns out to need beyond that is added then, and only that.

**CORS.** `CORS_ORIGINS`, a comma separated list of exact origins, each in the spelling a browser sends
(`new URL(x).origin === x`: `http` or `https`, lower case host, no path, no trailing slash, no default port; no `*`,
no `null`); validated at startup. Empty (the default) means `enableCors` is not called and no `Access-Control-*`
header is sent. Allowed: `GET, POST, PATCH, DELETE`, `Authorization` and `Content-Type`, `Retry-After` and
`X-RateLimit-*` exposed to the client, `maxAge` 600 s, **no credentials** (the tokens travel in the body and in
`Authorization`; the one cookie is for a top-level navigation to `/api/auth`). CORS comes before every guard, so a
`401` or `429` is readable by an allowed browser, and a preflight is answered before the limiter.

**Rate limit.** One throttler, two buckets per client address: the **strict** bucket for the routes marked
`@StrictRateLimit()` (the whole `AuthController`, so `login`, `callback`, `refresh` and `logout` add up and a route
added there later is strict without anyone remembering) and the **global** bucket for the rest. The key holds the
bucket and the client address but not the controller or the method; the limit is a function of the call. One
unnamed throttler keeps the plain `Retry-After` and `X-RateLimit-*` headers. Defaults: a window of 60 s
(`RATE_LIMIT_TTL_SECONDS`), 120 requests (`RATE_LIMIT_MAX`) and 10 for the strict bucket (`RATE_LIMIT_AUTH_MAX`).
`/api/health` is outside the limit (`@SkipRateLimit()`): the orchestrator calls it on a timer from one address, and a
`429` would make a healthy application look dead. The counters are in the memory of the process.

**Client address.** `TRUST_PROXY_HOPS`, a whole number 0 to 10, default 0, sets Express `trust proxy` to that number
of hops (only when above 0): `req.ip` is then the address the nearest trusted proxy saw, and entries a client wrote in
front of it do not count. 0 means `X-Forwarded-For` is ignored.

**Tests.** Every bootstrap of the whole `AppModule` (the e2e specs through `useAuthApp`, the integration suite through
`useIntegrationApp`) replaces `RATE_LIMIT_GUARD` with a guard that lets everything through
(`withoutRateLimit`), so a suite that sends hundreds of requests from one address never meets a `429`. The limit has
specs of its own that use the real guard with small numbers: the module over probe routes, and the whole app
(`useAuthApp({ rateLimited: true })`).

## Alternatives considered

- **Everything in `main.ts`** – the tests would not exercise what production does, and `configureApp` exists so they do.
- **Default `helmet` policy everywhere** – weaker for a JSON service, and the Swagger UI would need an exception on
  plain `http` anyway.
- **A wildcard or a pattern for CORS origins** – a pattern is easy to write too wide; with tokens in a header a
  wildcard is not a leak of credentials, but there is no browser client yet, so there is nothing to be generous for.
- **Credentialed CORS (cookies)** – the API does not authorise by cookie; allowing credentials would only widen what a
  cross-origin page may do.
- **The default key of the throttler (per route)** – `login` and `refresh` would not add up, and the "global" limit
  would be a limit per route.
- **Two named throttlers** – the answer headers get the name as a suffix (`Retry-After-auth`), which no client looks for.
- **`trust proxy: true` or a list of addresses** – `true` believes any `X-Forwarded-For` and lets a client choose its
  own address, which defeats the limit; a list of addresses is more than one proxy in front of a container needs and
  can be added later without breaking the hop count.
- **A shared store (Redis) for the counters** – a second service for one replica in a homelab; the memory store is
  enough until there is more than one replica.
- **A variable that switches the limiter off** – one wrong value in production removes the protection of the login.
- **Limits so high in the test environment that they never trigger** – every suite then depends on numbers, and
  nothing in the suite says that the limiter is out of the way; replacing the guard says so, in one helper.
- **A `NODE_ENV === 'test'` branch in the application** – production code that knows about the tests, and the test
  would not run the configuration production runs.

## Consequences

- One replica. The counters are lost on restart, and two replicas would each allow the whole limit; scaling out needs
  a shared store and a new decision.
- **`TRUST_PROXY_HOPS` must match the real number of proxies, in both directions.** 0 behind a proxy makes every client
  look like the proxy, so they share one bucket (anyone can use up the login limit for everybody, the owner included).
  A number above the real count lets a client choose its address with `X-Forwarded-For` and escape the limit. One
  proxy (Traefik, nginx, Caddy) in front of the container is 1. The README has to say it next to the deploy steps.
- Clients behind one NAT address share a bucket; for a single-user application that does not matter.
- A request over the limit is a `429` with `Retry-After` (seconds) and the body
  `{ statusCode: 429, message: 'ThrottlerException: Too Many Requests' }`; every other answer carries
  `X-RateLimit-Limit`, `-Remaining` and `-Reset`. A browser client needs the exposed headers above to read them.
- A route that opens the way to an account belongs in the strict bucket (`@StrictRateLimit()`), a route the
  orchestrator calls on a timer outside the limit (`@SkipRateLimit()`); a new public route is neither by default.
- A suite that boots the whole `AppModule` must apply `withoutRateLimit` or it meets the limit; a spec that proves a
  limit opts out and stays small and sequential.
- The Swagger UI is reachable in production like before (no token needed for the page); that is a decision for the
  operator, not made here.
- The HSTS header (`includeSubDomains`) is sent by the application also behind a proxy that terminates TLS; a browser
  honours it only on `https` answers, and the proxy can override it.
- `Cross-Origin-Resource-Policy: same-origin` does not stop a CORS `fetch`, only a `no-cors` load from another origin;
  to be checked with the first frontend on another origin.
