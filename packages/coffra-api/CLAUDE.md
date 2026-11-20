# CLAUDE.md — coffra API package (@lukasbriza/coffra-api)

Typed client of the coffra API (`apps/coffra-be`) for the frontends: React on the web and React Native (Expo). Built
from `templates/package-api`; inherits root `CLAUDE.md`.

## Stack

- `openapi-fetch` + `openapi-react-query` over the OpenAPI document of `coffra-be`. Built as a library (`dist/`, ESM).
- Peer deps: `@tanstack/react-query` + `react` (apps provide them — never bundle a second copy). Both run on the web and
  in React Native; `openapi-fetch` uses the global `fetch`.

## Why not `@lukasbriza/api`

The template is a workspace named `@lukasbriza/api` in this repo (`templates/*` are workspaces). Two workspaces with
one name make turbo fail (`Failed to add workspace … it already exists`) and pnpm link `workspace:*` to the template, so
this package has a name of its own and the templates stay as they are. The app templates (`app-react`, `app-next`,
`app-mobile`) still depend on `@lukasbriza/api`: **an app scaffolded from one switches to this package** in its
`package.json` (`"@lukasbriza/coffra-api": "workspace:*"`), in `lib/api.ts` and in its `CLAUDE.md`. Left as it is, the
app is linked to the template and its Cat Facts schema, and the types fail on the first `/api/...` call.

## Surface (`src/index.ts`)

- `createApi(baseUrl)` — the coffra API (schema `./schema.ts`): `{ fetchClient, $api }`.
  `$api.useQuery('get', '/api/dashboard', …)` and `$api.queryOptions(...)` are fully typed.
- `createApiClient<Paths>(baseUrl)` — the generic engine under it.
- `type Api`, `type paths` (the schema types).

## How apps use it

Each app owns the baseUrl (env is platform-specific) and the session, then binds the client once:

```ts
// app: lib/api.ts
import { createApi } from '@lukasbriza/coffra-api'
import { env } from './env'

export const { $api, fetchClient } = createApi(env.apiBaseUrl)
```

- **The session is the app's.** Every route but the login ones, `/api/health` and the refresh needs
  `Authorization: Bearer <access token>`. The tokens come in the body of the login callback and of
  `POST /api/auth/refresh`; where they are kept (memory, `expo-secure-store`) and when they are refreshed is decided by
  the app, not here. Add the header with a middleware; `$api` goes through the same `fetchClient`:

  ```ts
  fetchClient.use({
    onRequest: ({ request }) => {
      const token = session.accessToken()
      if (token !== undefined) request.headers.set('Authorization', `Bearer ${token}`)
      return request
    },
  })
  ```

- A web app needs its origin in `CORS_ORIGINS` of `coffra-be`; a native app does not.
- Components import `$api` from the app's `lib/api`, not from this package directly — that keeps a single client
  instance per app.

## Schema (the contract)

- `src/schema.json` is the OpenAPI document of `coffra-be`, written by its export; `src/schema.ts` is generated from it
  by `openapi-typescript`. **Both are committed**, so a change of the API shows in a pull request in both. Never
  hand-edit either.
- `pnpm --filter @lukasbriza/coffra-api api-schema:update` exports the document from `coffra-be`
  (`api-schema:export`, no database or `.env` needed) and regenerates the types (`api-schema:generate`). Run it after any
  change of a controller or a DTO there.
- Two checks keep them honest: `pnpm test` of `coffra-be` fails when `schema.json` is not the document of its code, and
  `pnpm test` here (`api-schema:check`, `openapi-typescript --check`) fails when `schema.ts` is not generated from
  `schema.json`.
- `.gitattributes` keeps both LF on every system (`core.autocrlf` would make them CRLF on a Windows checkout and both
  checks compare bytes); `.prettierignore` keeps prettier off both.
- `type-tests/contract.ts` checks a few rules of the contract at the type level in `pnpm ts` (money as a string, a
  nullable category, the dashboard periods, unknown routes refused). It is not built into `dist`.

## Don't touch

- Generated: `dist/`, `src/schema.json`, `src/schema.ts` (change `coffra-be`, then `api-schema:update`).
