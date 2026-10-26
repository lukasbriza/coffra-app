import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { RequestMethod } from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core'
import { describe, expect, it } from 'vitest'

import { IS_PUBLIC_KEY } from '../../../src/modules/core/auth/constants'
import { useIntegrationApp } from '../support/use-integration-app'

type Handler = (...args: never[]) => unknown

/**
 * Protected routes that hold no data of an owner, so there is nothing foreign to ask them for. A route added here is
 * a decision, like a new public route in `public-routes.spec.ts`.
 */
const WITHOUT_OWNER_DATA = new Set(['GET /api/users/me'])

/**
 * Reads the source of every isolation spec, this file aside.
 *
 * @returns the sources
 */
const specSources = (): string[] =>
  readdirSync(__dirname)
    .filter((file) => file.endsWith('.spec.ts') && file !== path.basename(__filename))
    .map((file) => readFileSync(path.join(__dirname, file), 'utf8'))

// Every protected route of the app needs an isolation spec: a `describe('<METHOD> <path>', …)` in one of the files of
// this folder. A new route fails here until it gets one.
describe('the isolation specs', () => {
  const { app } = useIntegrationApp({ imports: [DiscoveryModule] })

  /** Every route that is not `@Public()`, as `<METHOD> <path>` with the global prefix. */
  const protectedRoutes = (): string[] => {
    const reflector = app().get(Reflector)
    const scanner = new MetadataScanner()

    return app()
      .get(DiscoveryService)
      .getControllers()
      .flatMap(({ metatype, instance }) => {
        const prototype = Object.getPrototypeOf(instance) as Record<string, Handler>
        const controller = metatype as new (...args: never[]) => unknown
        const base = Reflect.getMetadata(PATH_METADATA, controller) as string

        return scanner
          .getAllMethodNames(prototype)
          .filter((method) => Reflect.hasMetadata(PATH_METADATA, prototype[method]))
          .filter(
            (method) =>
              !reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [prototype[method], controller]),
          )
          .map((method) => {
            const handler = prototype[method]
            const verb = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod]
            const segments = ['api', base, Reflect.getMetadata(PATH_METADATA, handler) as string]
              .flatMap((segment) => segment.split('/'))
              .filter((segment) => segment !== '')

            return `${verb} /${segments.join('/')}`
          })
      })
      .toSorted()
  }

  it('finds the protected routes of the app', () => {
    // A discovery that finds nothing would make the next test pass for nothing.
    expect(protectedRoutes()).toEqual(
      expect.arrayContaining(['GET /api/accounts/:id', 'DELETE /api/transfers/:pairId', 'GET /api/users/me']),
    )
  })

  it('has an isolation spec for every protected route that holds data of an owner', () => {
    const sources = specSources()

    const uncovered = protectedRoutes()
      .filter((route) => !WITHOUT_OWNER_DATA.has(route))
      .filter((route) => !sources.some((source) => source.includes(`describe('${route}'`)))

    expect(uncovered).toStrictEqual([])
  })
})
