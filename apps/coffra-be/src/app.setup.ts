import { type INestApplication, ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'

/** Prefix of every route: `/api/...`. */
export const GLOBAL_PREFIX = 'api'

/**
 * Configures an application the same way in `main.ts` and in tests, so both boot with identical behaviour.
 *
 * Sets the global prefix, the cookie parser, the global validation pipe (`whitelist` drops unknown properties,
 * `transform` turns payloads into DTO instances) and the shutdown hooks. The authentication guard is not part of it
 * on purpose: an app booted without that line has no authentication, so `main.ts` adds it in plain sight.
 *
 * @param app - the application to configure
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(GLOBAL_PREFIX)
  // Unsigned: the cookies the app sets carry their own signature (e.g. the login checks JWT).
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  // Lets PrismaService.onModuleDestroy run on SIGTERM (Docker/k3s stop).
  app.enableShutdownHooks()
}
