import type { Type } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { OpenAPIObject } from '@nestjs/swagger'

import { configureApp } from '../../src/app.setup'
import { buildSwaggerDocument } from '../../src/swagger.setup'

/**
 * Builds the OpenAPI document of an application without starting it.
 *
 * The application is created in the preview mode of Nest: no provider and no controller is instantiated and nothing
 * is initialised, so nothing connects to a database, to Redis or to the identity provider, whatever a provider does
 * in its constructor or when its module starts. `configureApp` gives the routes their global prefix; CORS and the
 * proxy count do not change the document, so it runs without options. A module that cannot be built rejects the
 * promise (it never ends the process) and nothing is logged.
 *
 * @param rootModule - the root module of the application (`AppModule`)
 * @returns the document, as `/api/swagger-json` serves it
 * @throws Error when Nest cannot build the modules (an unknown dependency, an undefined import)
 */
export const buildOpenApiDocument = async (rootModule: Type<unknown>): Promise<OpenAPIObject> => {
  const app = await NestFactory.create(rootModule, { preview: true, abortOnError: false, logger: false })

  try {
    configureApp(app)

    return buildSwaggerDocument(app)
  } finally {
    await app.close()
  }
}
