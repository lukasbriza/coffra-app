# 0024 – Developer scripts run with tsx from `scripts/`; the demo seed replaces the data of one user

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

A developer needs commands that use the code of the app and its generated Prisma client from a terminal: filling the
development database with demo data now, and other tools later. What shapes them:

- The client Prisma 7 generates into `src/modules/prisma/generated` imports its own files with the extension `.js`
  (`./enums.js`, `./internal/class.js`) while the files on disk are `.ts`. `ts-node` 10.9 does not map one to the other
  in a CommonJS app: `ts-node -e "import { PrismaClient } from './src/modules/prisma/generated/client'"` ends with
  `Cannot find module './internal/class.js'`. Vitest and `tsx` do map it.
- `pnpm build` and `pnpm dev` both start with `rimraf build`. A script that needs the compiled `build/` cannot be run
  while the development server is watching, and the image holds only `build/` and the production dependencies.
- The development Keycloak has one login user, whose `sub` is fixed in `docker/keycloak/coffra-realm.json`. The app finds
  a `User` by `(oidc, sub)`, so data written for that `sub` is what the first login shows.
- The database stops a malformed transaction (CHECK constraints, the unique pair of a transfer) but not a half-written
  data set: a transfer with one side is a valid row.

## Decision

- **Developer scripts live in `apps/coffra-be/scripts/<name>/` and run with `tsx`**, a `devDependency` with an exact
  version, started from a `package.json` script (`pnpm db:seed`). They are type-checked and linted with the app
  (`tsconfig.json` includes them), are not compiled by `nest build` and are not in the image. A command that has to run
  from the image belongs in `src/`, so it ends up in `build/`.
- **The seed is a function and a thin command line.** `seedDemo(client, today)` takes the client and the day as
  arguments, and `main.ts` only reads the environment and the clock once, checks that seeding is allowed, connects, calls
  the function and prints one sentence. The rows come from a pure function of the day (`buildLedger`): the same day
  gives the same data, with no randomness and no time zone.
- **The demo user is the user of the dev realm.** The seed finds or creates the `User` with that fixed `sub` and e-mail,
  deletes everything that user owns (transactions, then accounts and categories, because both foreign keys of a
  transaction are `Restrict`) and writes the demo data, all in one database transaction. Running it again replaces
  the data; a failure leaves what was there. The `User` row is never deleted, so its id and the tokens issued for it keep
  working. Only rows of that user are touched.
- **Production is refused before anything is read or connected.** `NODE_ENV=production` ends the command with an error;
  a missing `NODE_ENV` counts as development, like in the configuration of the app. The variable of the shell wins over
  `.env`, because the command does not set it.
- **The data covers the widest period of the dashboard.** Twelve calendar months including the current one, where the
  current month holds only the days up to today, and one planned payment a few days after today (counted by the
  dashboard, not by the balance). Two currencies, transfers, and transactions without a category. A transfer is one
  item in the data that is written as both of its sides in the same statement, so the two rows cannot differ.

## Alternatives considered

- **`ts-node`** – already in the dependencies, but it cannot load the generated client (see Context).
- **Compile with `nest build` and run `node build/…`** – `build` deletes `build/` under a running `pnpm dev`, and the
  seed would ship in the image for no reason. `tsc` without the clean step works, but it is a manual workaround.
- **`prisma db seed` with `prisma/seed.ts`** – the natural place for Prisma, but ESLint ignores `prisma/`, so the code
  would be neither linted nor covered by specs the way the rest is, and it still needs a runner for TypeScript.
- **Add to the data instead of replacing it** – accounts have no unique key, so a second run would duplicate them or need
  a matching heuristic. Replacing gives the same result every time.
- **Allow only a local database** – refuses a legitimate development database on another machine. A mistake is limited
  anyway: only the user with the `sub` of the dev realm is touched, and a real identity provider issues other ones.
- **Fill the data through the HTTP API** – needs a running server and a login, and would run through a hundred requests
  for what is one transaction.

## Consequences

- Running `pnpm db:seed` deletes what the dev user created by hand in the development database. Other users are not
  touched.
- The identity of the demo user is written twice, in the realm file and in `scripts/seed/constants.ts`. A spec compares
  them, so a change of the realm without the constant fails.
- `tsx` is a new `devDependency` (its version was already in the lockfile as an optional peer of Vite). `ts-node` is no
  longer needed for anything in this app.
- A future script that touches the database or the app code follows the same layout. One that has to run from the image
  is a different case and goes into `src/`.
- Dates are in UTC like everywhere in the API: a developer east of UTC sees the seed of "today" one day behind between
  their midnight and UTC midnight, as with the balance of an account.
