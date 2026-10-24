import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger'

import { GLOBAL_PREFIX } from './app.setup'

/** Path of the Swagger UI, under the global prefix: `/api/swagger`. */
export const SWAGGER_PATH = `${GLOBAL_PREFIX}/swagger`

/**
 * Builds the OpenAPI document of the API.
 *
 * Separate from `setupSwagger` so the spec can be produced without `listen` (OpenAPI export). Every route requires
 * the bearer token unless it is `@Public()`, which clears the requirement on its operation.
 *
 * @param app - the configured application whose routes are documented
 * @returns the OpenAPI document
 */
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

/**
 * Mounts the Swagger UI at `SWAGGER_PATH`; the entered token is remembered between page loads.
 *
 * @param app - the configured application to document
 */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, buildSwaggerDocument(app), {
    swaggerOptions: { persistAuthorization: true },
  })
}
