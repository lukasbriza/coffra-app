# coffra-web

The web app of Coffra: Next.js 16 (App Router), React 19, `cs` and `en`.

## Getting started

The web reads its data from the coffra API (`apps/coffra-be`) on the server, so run the API first (see
`apps/coffra-be/README.md`); it listens on port 3000.

```bash
cp .env.example .env.local   # API_BASE_URL=http://localhost:3000
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001). The app runs on port 3001, next to the API on 3000.

`API_BASE_URL` is required by `pnpm dev` and `pnpm start`: without it, or with a value that is not an `http(s)` origin,
the server logs the reason at start and answers 500. `pnpm build` does not need it.
