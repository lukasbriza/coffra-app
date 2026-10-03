# 0007 – Stay CommonJS, pin or avoid ESM-only packages

- **Status:** Accepted
- **Date:** 2026-10-01
- **Milestone / task:** M0, #4 (T4); OIDC library open in #9 (T6)

## Context

The app is CommonJS (`nest build` emits to `build/`, as the Nest template ships it). Some dependencies
have moved to ESM-only releases that a CommonJS app cannot `require` safely.

## Decision

Keep the app CommonJS and deal with ESM-only packages one by one:

- `@nestjs/terminus` is pinned to **11.x**; 12.x is ESM-only.
- `openid-client` v6 is ESM-only too. Node >= 22 can `require(esm)`, but whether it works cleanly in this app is to be proven by the spike in #9, with `jose` and a hand-written code exchange as the fallback.

## Alternatives considered

- **Switch the app to ESM** – would remove the problem, but the Nest template and tooling here are CommonJS. Not pursued.

## Consequences

- Dependency upgrades need a check: a new major may be ESM-only. Do not bump pinned packages blindly.
- The OIDC library choice is not final until #9 is done; the outcome should be added here or as a new record.
