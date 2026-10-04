import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory, Reflector } from '@nestjs/core'

import { AppModule } from './app.module'
import { configureApp } from './app.setup'
import type { Env } from './modules/config'
import { AuthTokensService, JwtAuthGuard } from './modules/core'
import { SWAGGER_PATH, setupSwagger } from './swagger.setup'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  configureApp(app)
  // Every route needs an access token unless it is `@Public()` (ADR 0011). Not part of `configureApp` on purpose:
  // an app booted without this line has no authentication, so the line stays here, in plain sight.
  const jwtAuthGuard = new JwtAuthGuard(app.get(Reflector), app.get(AuthTokensService))
  app.useGlobalGuards(jwtAuthGuard)
  setupSwagger(app)

  const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true })
  await app.listen(port)

  const bootstrapLogger = new Logger('Bootstrap')
  bootstrapLogger.log(`Listening on http://localhost:${port}`)
  bootstrapLogger.log(`Swagger on http://localhost:${port}/${SWAGGER_PATH}`)
}

void bootstrap()
