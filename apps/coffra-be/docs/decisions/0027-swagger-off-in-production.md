# 0027 – Swagger UI off in production by default

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

`setupSwagger` mounts the Swagger UI at `/api/swagger` and the OpenAPI document at `/api/swagger-json` and `-yaml`.
They are Express routes outside the Nest pipeline: no guard runs there, so they need no token and are not counted by
the rate limit (ADR 0025). In production that publishes the whole surface of the API, every route, parameter and
answer, to anyone who can reach the server, and serves it without a limit.

The document is still needed outside development: a frontend generates its client from it. That does not need the
running server: `buildSwaggerDocument` builds it from the application without `listen`, which is what an offline
export uses.

## Decision

**`SWAGGER_ENABLED` decides whether `main.ts` calls `setupSwagger`.** `true` or `false`; left out (or empty), it is
`true` outside production and `false` in production (`validateEnv` fills it in from `NODE_ENV`). Any other value stops
the start. Production can still turn it on on purpose, for example behind a proxy that restricts who reaches it.

The document for clients comes from the code, not from the production server: `buildSwaggerDocument`, which does not
depend on `SWAGGER_ENABLED`.

## Alternatives considered

- **Always on** – the state before: the surface of the API public in production, outside the rate limit.
- **Behind the rate limit** – the routes are not Nest routes, so the limit would need its own middleware next to the
  guard, and the surface would still be public.
- **Behind the token** – the UI is what a developer uses to get to a token in the first place, and the document would
  still be needed without one by the tools that generate a client.
- **Off everywhere, a separate documentation site** – one more thing to build and run, for a document the code already
  produces.

## Consequences

- A production container answers `404` on `/api/swagger` and `/api/swagger-json` unless `SWAGGER_ENABLED=true`; the
  image specs hold both cases.
- Development and the tests keep the UI without configuring anything (`NODE_ENV` is not `production` there).
- Whoever turns it on in production decides who may reach it; the application adds no protection of its own.
