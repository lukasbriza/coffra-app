import { type INestApplication, ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'

export const GLOBAL_PREFIX = 'api'

/** Shared by `main.ts` and tests, so both boot the app with identical behaviour. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(GLOBAL_PREFIX)
  // Unsigned: the cookies the app sets carry their own signature (e.g. the login checks JWT).
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  // Lets PrismaService.onModuleDestroy run on SIGTERM (Docker/k3s stop).
  app.enableShutdownHooks()
}
