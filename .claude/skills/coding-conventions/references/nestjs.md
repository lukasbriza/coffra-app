# NestJS conventions

Read with `coding-conventions` (base). Applies to `apps/*` Nest apps. CommonJS; `nest build` -> `build/`.

## Module structure

One feature = one module folder under `src/modules/<feature>/`:

```
src/modules/users/
  users.module.ts      # @Module wiring
  users.controller.ts  # HTTP layer — thin
  users.service.ts     # business logic — @Injectable
  dto/                 # request/response DTOs
```

`app.module.ts` imports feature modules; `main.ts` bootstraps (Swagger + `app.listen`).

## Classes, not arrow consts

Nest needs decorated **classes** — this is the base skill's `class` exception. Providers/controllers
are classes with **method** members (`getHello(): string {}`), not arrow-property fields.
Dependencies via constructor injection with an explicit token:
`constructor(@Inject(UsersService) private readonly usersService: UsersService) {}`.

```ts
@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<UserDto[]> {
    return this.usersService.findAll()
  }
}
```

- `@Inject(Token)` is required on every constructor parameter: vitest (esbuild) emits no
  `design:paramtypes`, so type-based injection resolves to `undefined` in tests (works in
  `nest build`, which hides the bug). The token must be a value import, not `import type`.
- Controllers stay thin — validate, delegate to a service, shape the response. No business logic.
- Services own logic and data access; keep them injectable and unit-testable.

## DTOs & validation

- One `class` DTO per request/response shape in `dto/`; validate with `class-validator` decorators.
- Enable a global `ValidationPipe` (`whitelist: true`, `transform: true`).
- Annotate DTOs/endpoints with `@nestjs/swagger` decorators — Swagger is served at `api/swagger`.

## JSDoc

The base skill's Comments rules, applied to what a Nest app is made of. The `// Swagger` separator stays a plain
`//`; the JSDoc goes above everything, decorators included.

| Declaration | The block says |
|---|---|
| `@Module` class | what the module offers; why it imports what it imports (`OwnershipModule`, not `CoreModule`) |
| Controller class | the HTTP layer of `/api/<path>`: takes the owner and the validated input, delegates to the service, no logic |
| Controller method | first line the route (`` `GET /api/accounts/:id`: reads one account … ``); `@param` for owner / id / dto / query; `@returns`; `@throws` per HTTP error the service raises |
| Service class | what it owns and the invariant every method keeps (e.g. every query carries the owner scope) |
| Service method | summary and the rule it enforces; `@param`; `@returns`; `@throws ConflictException when …` per exception |
| Private helper | same, short; say which error it turns into which status |
| DTO class | the route it is the body or query of; a field gets a block **only** for a rule (a validation choice, a field declared just to be refused), the rest is `@ApiProperty` |
| Mapper | the only way a row leaves the service; `@param row`, `@returns` |
| Validator decorator | what it validates; `@returns the property decorator`; the helper `(value, args)` says when it passes on purpose |
| `*.types.ts` | one block per type, fields under `@property name - …` |
| `constants.ts` | one line per constant: what it is for |

```ts
/**
 * `GET /api/accounts/:id`: reads one account of the signed-in user.
 *
 * @param owner - whose account it has to be, from the access token
 * @param id - id of the account; a value that is not a UUID is a `400`
 * @returns the account with its balance
 * @throws NotFoundException when the id is not an account of the owner
 */
@Get(':id')
// Swagger
@ApiOperation({ summary: 'One account' })
findOne(@CurrentOwner() owner: Owner, @Param('id', ParseUUIDPipe) id: string): Promise<AccountView> {}

/**
 * What the API returns for an account.
 *
 * @property id - id of the account (UUID)
 * @property balance - opening balance plus every transaction up to the day asked for
 */
export type AccountView = { id: string; balance: string }
```

## Config

- Read env via `@nestjs/config` (`ConfigModule`/`ConfigService`), not raw `process.env`.

## Prisma (optional `--prisma` variant)

- `PrismaService extends PrismaClient` in a **Global** `PrismaModule` (`src/modules/prisma/`);
  inject `PrismaService`, never instantiate `PrismaClient` elsewhere.
- Prisma 7: driver adapter (`@prisma/adapter-pg` `PrismaPg`) wired in the service; connection URL
  comes from `prisma.config.ts` — the schema carries **no `url`**.
- Client is generated to `src/modules/prisma/generated` — never edit it; run `pnpm prisma:generate`
  after schema changes (also runs on `postinstall`).

## Tests

- `vitest` (`vitest.config.mjs`), specs under `test/`. Unit-test services by mocking injected deps.

## Common Mistakes

| Mistake | Instead |
|---|---|
| Constructor param without `@Inject(Token)` | add it — DI fails under vitest otherwise |
| Business logic in a controller | move it to the service |
| `new PrismaClient()` in a module | inject `PrismaService` |
| Raw `process.env` | `ConfigService` |
| Untyped/unvalidated body | DTO class + `class-validator` |
| Controller or service method with no `@throws` for its HTTP errors | one `@throws ExceptionType when …` per error |
| `//` above a class or a DTO field | JSDoc block (DTO field: only when it carries a rule) |
| `url` in `schema.prisma` (v7) | `prisma.config.ts` + adapter |
| Editing prisma `generated/` | `pnpm prisma:generate` |
