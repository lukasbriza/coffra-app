# 0028 – OpenAPI export compiled with tsc, the contract committed in the API package

- **Status:** Accepted
- **Date:** 2026-11-03

## Context

The frontends (React on the web, React Native with Expo) call the API through a typed client: `openapi-fetch` and
`openapi-react-query` over the types `openapi-typescript` generates from an OpenAPI document. The monorepo has a
template for that package (`templates/package-api`); it reads a committed `src/schema.json`. The document of this app
is what `buildSwaggerDocument` builds, and the server serves it only when `SWAGGER_ENABLED` (ADR 0027), so a client
cannot take it from production. What shapes the export:

- **The document needs the decorator metadata.** `@nestjs/swagger` reads the type of an `@ApiProperty()` without
  `type` from `design:type`, and the type of a body, a query DTO or a path parameter from `design:paramtypes`; most
  decorators of this app rely on it. `tsx` (ADR 0024) compiles with esbuild, which emits no decorator metadata: under
  `tsx` the document of the app is not built at all (`[TokenPairDto] A circular dependency has been detected (property
key: "accessToken")…`). `tsc` (what `nest build` runs) emits it. Vitest 4 on Vite 8 compiles with Oxc, which emits it
  too: the document it builds is byte for byte the one of the compiled app.
- **Starting the app connects.** `PrismaService` opens its connection when its module starts. Importing the
  configuration validates the environment at once, from the process and from a `.env` in the working directory, the
  process winning: an optional variable that the process does not set is read from a developer's `.env`, and a wrong
  value there stops the start.
- **The order of the keys of the document** follows the order of the modules, controllers and decorators, so moving an
  import changes the document without changing the API.
- **In this repository the templates are workspaces,** and the template of the API package is named `@lukasbriza/api`.
  Its generator copies it without a new name. With two workspaces of one name, turbo refuses to run
  (`Failed to add workspace … it already exists`) and pnpm links `workspace:*` to the template. The app templates
  (`app-react`, `app-next`, `app-mobile`) depend on `@lukasbriza/api` and call a sample route of another API.
- **Line endings:** Git on the development machine converts to CRLF on checkout (`core.autocrlf=true`) and the
  repository has no `.gitattributes`.

## Decision

- **`pnpm openapi:export --out <file>`** in this app writes the document. The code is in `scripts/openapi/` and is
  **compiled with `tsc`** (`tsconfig.openapi.json`: `src` and `scripts/openapi` into `build/openapi/`, not incremental)
  and run with `node`. This narrows ADR 0024: a developer script that needs the decorator metadata is compiled with
  `tsc` instead of run with `tsx`. `build/openapi/` is an intermediate result; `rimraf build` may delete it, the next
  export compiles again.
- **The app is created in the preview mode of Nest** (`preview: true`, `abortOnError: false`, `logger: false`) and never
  initialised: no provider or controller is instantiated, nothing connects, whatever a provider does in its constructor
  or when its module starts. `configureApp` runs without options (the global prefix is part of the document; CORS and
  the proxy count are not). A module that cannot be built rejects with the reason of Nest.
- **The export sets its own environment** (`EXPORT_ENV`): every variable of the app, the optional ones included,
  production, nothing that points at a real server. It replaces what the process and a `.env` hold, before anything
  that reads the configuration is imported, so the document does not depend on the machine or on `SWAGGER_ENABLED`.
- **The text is stable:** the keys of every object sorted by code units, arrays in their order (the order of
  parameters, required properties and enum values is what a generated client follows), two spaces, `\n` on every
  system, one `\n` at the end. `--out` is required; the export writes nowhere else.
- **The contract lives in the API package `@lukasbriza/coffra-api`** (`packages/coffra-api`, from the template, with a
  name of its own so the templates stay workspaces). Its `src/schema.json` (the export) and `src/schema.ts` (the types)
  are both committed, so a change of the API shows in a pull request in both, and both are LF in every working copy
  (`.gitattributes`). `api-schema:update` of the package exports and regenerates. Two checks keep them in step:
  `pnpm test` of this app compares `schema.json` with the document of its code, `pnpm test` of the package runs
  `openapi-typescript --check`. The session (where the tokens are kept, when they are refreshed) stays in each app: it
  adds the bearer token through a middleware of the client.

## Alternatives considered

- **`tsx`, like the seed** – the document is not built (see Context).
- **`tsx` with an explicit `type` on every Swagger decorator** – about ninety places, and a forgotten one leaves a body
  or a query out of the document without an error, so the export would differ from what the server serves.
- **The export in `src/`, run from `nest build`** – `pnpm build` deletes `build/` under a running `pnpm dev` (the
  reason of ADR 0024), and the export would ship in the image.
- **A loader that emits metadata (`@swc-node/register`, `oxc-node`) or the module runner of Vite** – a new dependency or
  an internal API, and another compiler than the one of production.
- **A testing module with `PrismaService` and `RedisService` replaced** – a testing package in a script, and a list of
  stubs that grows with every provider that connects. **Creating the app without the preview mode** gives the same
  document but runs the constructors.
- **The order of Nest** – stable for the same code, but a moved import would change the contract.
- **A default output file in the app** – one more ignored file; the only copy that matters is the one in the package.
- **The package under the name of the template, with the templates excluded from the workspace** – works, but four
  templates would no longer be installed, linted or type-checked here and the lockfile would lose their importers.
- **Only `schema.json` committed, `schema.ts` generated on install** – one source, but the types would not show in a
  pull request and the package would differ from its template more.

## Consequences

- An export takes about five seconds, most of it the compilation.
- A new variable in `env.validation.ts` needs a value in `EXPORT_ENV`: `pnpm ts` fails without it (`satisfies`), and so
  does its spec.
- Every change of a controller or a DTO needs `pnpm --filter @lukasbriza/coffra-api api-schema:update`, or `pnpm test`
  of this app fails and names the command.
- The specs that build the document in their own process rely on Vitest emitting the metadata as `tsc` does; the spec
  of the command compares the two and fails first if a compiler upgrade changes that.
- The properties of a schema are in alphabetical order in the document and in the generated types, not in the order of
  the DTO.
- An app scaffolded from an app template switches its dependency and its `lib/api.ts` from `@lukasbriza/api` to
  `@lukasbriza/coffra-api`; left as it is, it is linked to the template and its types fail on the first call of this
  API.
