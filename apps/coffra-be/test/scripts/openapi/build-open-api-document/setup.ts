import 'reflect-metadata'

import { type DynamicModule, type ForwardReference, RequestMethod, type Type } from '@nestjs/common'
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { MetadataScanner } from '@nestjs/core'
import type { OpenAPIObject } from '@nestjs/swagger'
import { beforeAll } from 'vitest'

import { buildOpenApiDocument } from '../../../../scripts/openapi/build-open-api-document'
import { OPERATION_METHODS } from '../../../../scripts/openapi/constants'
import { AppModule } from '../../../../src/app.module'
import { GLOBAL_PREFIX } from '../../../../src/app.setup'
import { IS_PUBLIC_KEY } from '../../../../src/modules/core/auth/constants'

// Shared by the specs of `buildOpenApiDocument` over the real `AppModule`. The routes the document is compared with come
// from the decorators of the controllers, found by walking the imports of the modules: nothing of Swagger is used to
// find them, so a route the document left out cannot hide.

/** The exact public surface of the API (`test/modules/core/public-routes.spec.ts` pins the same list by handler). */
export const PUBLIC_ROUTES = [
  'GET /api/auth/callback',
  'GET /api/auth/login',
  'GET /api/health',
  'POST /api/auth/logout',
  'POST /api/auth/refresh',
]

/**
 * A route of the app as its decorators declare it.
 *
 * @property route - `<METHOD> <path>` with the global prefix and the parameters as OpenAPI writes them (`{id}`)
 * @property isPublic - whether the handler or its controller is `@Public()`
 */
export type DeclaredRoute = {
  route: string
  isPublic: boolean
}

/**
 * An operation of an OpenAPI document.
 *
 * @property route - `<METHOD> <path>`
 * @property security - the requirement of the operation itself; `undefined` when the global one applies
 */
export type DocumentOperation = {
  route: string
  security: OpenAPIObject['security']
}

type Handler = (...args: never[]) => unknown

type ModuleImport = Type<unknown> | DynamicModule | Promise<DynamicModule> | ForwardReference | undefined

/**
 * Finds every controller of a module and of all the modules it imports, at any depth: static imports, dynamic modules
 * (also those `forRoot` gives as a promise) and forward references.
 *
 * @param root - the root module
 * @returns the controller classes
 */
const controllersOf = async (root: Type<unknown>): Promise<Type<unknown>[]> => {
  const visited = new Set<unknown>()
  const controllers = new Set<Type<unknown>>()

  const visit = async (entry: ModuleImport): Promise<void> => {
    const resolved = await entry

    if (resolved === undefined || visited.has(resolved)) {
      return
    }

    visited.add(resolved)

    if (typeof resolved !== 'function' && 'forwardRef' in resolved) {
      const target = resolved.forwardRef as () => ModuleImport

      await visit(target())

      return
    }

    const dynamic = typeof resolved === 'function' ? undefined : resolved
    const moduleClass = dynamic?.module ?? (resolved as Type<unknown>)
    const declared = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) ?? []) as Type<unknown>[]

    for (const controller of [...declared, ...(dynamic?.controllers ?? [])]) {
      controllers.add(controller)
    }

    const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ?? []) as ModuleImport[]

    for (const imported of [...imports, ...((dynamic?.imports ?? []) as ModuleImport[])]) {
      await visit(imported)
    }
  }

  await visit(root)

  return [...controllers]
}

/**
 * Lists the routes one controller declares.
 *
 * @param controller - the controller class
 * @returns its routes
 */
const routesOfController = (controller: Type<unknown>): DeclaredRoute[] => {
  const prototype = controller.prototype as Record<string, Handler>
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string
  const isPublicController = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true

  return new MetadataScanner()
    .getAllMethodNames(prototype)
    .filter((method) => Reflect.hasMetadata(PATH_METADATA, prototype[method]))
    .map((method) => {
      const handler = prototype[method]
      const verb = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod]
      const segments = [GLOBAL_PREFIX, base, Reflect.getMetadata(PATH_METADATA, handler) as string]
        .flatMap((segment) => segment.split('/'))
        .filter((segment) => segment !== '')
        .map((segment) => (segment.startsWith(':') ? `{${segment.slice(1)}}` : segment))

      return {
        route: `${verb} /${segments.join('/')}`,
        isPublic: isPublicController || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
      }
    })
}

/**
 * Lists the operations of an OpenAPI document.
 *
 * @param document - the document
 * @returns one entry per method of each path
 */
export const operationsOf = ({ paths }: OpenAPIObject): DocumentOperation[] =>
  Object.entries(paths).flatMap(([path, item]) =>
    OPERATION_METHODS.filter((method) => item[method] !== undefined).map((method) => ({
      route: `${method.toUpperCase()} ${path}`,
      security: item[method]?.security,
    })),
  )

/**
 * Builds the document of the whole app and finds its declared routes once for the `describe` block it is called in.
 *
 * @returns the document and the routes
 */
export const useAppDocument = () => {
  let document: OpenAPIObject | undefined
  let routes: DeclaredRoute[] = []

  beforeAll(async () => {
    const controllers = await controllersOf(AppModule)

    document = await buildOpenApiDocument(AppModule)
    routes = controllers.flatMap((controller) => routesOfController(controller))
  }, 30_000)

  return {
    /** The document of the app. */
    document: (): OpenAPIObject => {
      if (document === undefined) {
        throw new Error('The document is built in beforeAll')
      }

      return document
    },
    /** The routes the controllers of the app declare. */
    routes: (): DeclaredRoute[] => routes,
  }
}
