import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger'

import { GLOBAL_PREFIX } from './app.setup'

export const SWAGGER_PATH = `${GLOBAL_PREFIX}/swagger`

/** Separate from `setupSwagger` so the spec can be produced without `listen` (OpenAPI export). */
export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('coffra-be API')
    .setDescription('Personal finance overview API')
    .setVersion('1.0')
    .addBearerAuth()
    // Every route needs the token unless it is `@Public()`, which overrides this on the operation.
    .addSecurityRequirements('bearer')
    .build()

  return SwaggerModule.createDocument(app, config)
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, buildSwaggerDocument(app), {
    swaggerOptions: { persistAuthorization: true },
  })
}
