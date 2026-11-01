import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger'
import { contentSecurityPolicy } from 'helmet'

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
    .setDescription(
      'Personal finance overview API. Requests are limited per client address: past the limit a request is answered ' +
        'with 429 and a Retry-After header (seconds), the login routes have a lower limit than the rest.',
    )
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
 * The UI is a page that loads its own scripts and styles from the same origin, which the policy of the API (`none`
 * for everything) forbids. Under `SWAGGER_PATH` only, the header is replaced with the default policy of `helmet`
 * (`'self'` for scripts, images and requests) **without** `upgrade-insecure-requests`: that directive makes a browser
 * fetch the scripts of a page served over plain `http` (the dev server) with `https` and the page stays empty.
 * The JSON and YAML documents (`SWAGGER_PATH` followed by `-json` or `-yaml`) are outside that path and keep the strict
 * policy.
 *
 * @param app - the configured application to document
 */
export function setupSwagger(app: INestApplication): void {
  app.use(
    `/${SWAGGER_PATH}`,
    contentSecurityPolicy({ useDefaults: true, directives: { 'upgrade-insecure-requests': null } }),
  )
  SwaggerModule.setup(SWAGGER_PATH, app, buildSwaggerDocument(app), {
    swaggerOptions: { persistAuthorization: true },
  })
}
