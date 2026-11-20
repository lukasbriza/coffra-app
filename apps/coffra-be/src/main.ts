import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory, Reflector } from '@nestjs/core'

import { AppModule } from './app.module'
import { configureApp } from './app.setup'
import type { Env } from './modules/config'
import { AuthTokensService, JwtAuthGuard } from './modules/core'
import { SWAGGER_PATH, setupSwagger } from './swagger.setup'

/**
 * Starts the HTTP server.
 *
 * Creates the application, configures it (security headers, CORS and the proxy count from the environment), makes the
 * authentication guard global, mounts Swagger when `SWAGGER_ENABLED` (by default not in production) and listens on the
 * port from the configuration.
 */
const bootstrap = async () => {
  const app = await NestFactory.create(AppModule)
  const config = app.get<ConfigService<Env, true>>(ConfigService)

  configureApp(app, {
    corsOrigins: config.get('CORS_ORIGINS', { infer: true }),
    trustProxyHops: config.get('TRUST_PROXY_HOPS', { infer: true }),
  })
  // Every route needs an access token unless it is `@Public()`. Not part of `configureApp` on purpose: an app booted
  // without this line has no authentication, so the line stays here, in plain sight.
  const jwtAuthGuard = new JwtAuthGuard(app.get(Reflector), app.get(AuthTokensService))
  app.useGlobalGuards(jwtAuthGuard)
  const swaggerEnabled = config.get('SWAGGER_ENABLED', { infer: true }) === true
  if (swaggerEnabled) {
    setupSwagger(app)
  }

  const port = config.get('PORT', { infer: true })
  await app.listen(port)

  const bootstrapLogger = new Logger('Bootstrap')
  bootstrapLogger.log(`Listening on http://localhost:${port}`)
  if (swaggerEnabled) {
    bootstrapLogger.log(`Swagger on http://localhost:${port}/${SWAGGER_PATH}`)
  }
}

void bootstrap()
