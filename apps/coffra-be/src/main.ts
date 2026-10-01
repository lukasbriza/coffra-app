import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { configureApp } from './app.setup'
import type { Env } from './modules/config'
import { SWAGGER_PATH, setupSwagger } from './swagger.setup'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  configureApp(app)
  setupSwagger(app)

  const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true })
  await app.listen(port)

  const bootstrapLogger = new Logger('Bootstrap')
  bootstrapLogger.log(`Listening on http://localhost:${port}`)
  bootstrapLogger.log(`Swagger on http://localhost:${port}/${SWAGGER_PATH}`)
}

void bootstrap()
