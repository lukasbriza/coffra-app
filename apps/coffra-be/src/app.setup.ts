import { type INestApplication, ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import type { Express } from 'express'
import helmet from 'helmet'

import type { AppOptions } from './app.types'

/** Prefix of every route: `/api/...`. */
export const GLOBAL_PREFIX = 'api'

/**
 * Content Security Policy of the API. It answers with JSON and never with a page, so nothing may load or embed
 * anything: no sources at all, no `<base>`, no form target and no frame around a response. The one exception is the
 * Swagger UI (`setupSwagger`), a page that has to load its own scripts.
 */
export const API_CONTENT_SECURITY_POLICY = {
  defaultSrc: ["'none'"],
  baseUri: ["'none'"],
  formAction: ["'none'"],
  frameAncestors: ["'none'"],
}

/** The methods the API has. The preflight of any other (`PUT`, ...) is not answered with a permission. */
const CORS_METHODS = ['GET', 'POST', 'PATCH', 'DELETE']

/** The request headers a browser client sends: the bearer token and the JSON body. */
const CORS_ALLOWED_HEADERS = ['Authorization', 'Content-Type']

/** Response headers a browser client may read: how long to wait after a `429` and how much of the limit is left. */
const CORS_EXPOSED_HEADERS = ['Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']

/** How long a browser may remember the answer to a preflight, in seconds. */
const CORS_MAX_AGE_SECONDS = 600

/**
 * Configures an application the same way in `main.ts` and in tests, so both boot with identical behaviour.
 *
 * Sets, in this order: the number of trusted proxies (only when above zero), the security headers (`helmet`, with the
 * strict policy of the API and without `X-Powered-By`), CORS (only when origins are given: without them the
 * application sends no CORS header at all), the global prefix, the cookie parser, the global validation pipe
 * (`whitelist` drops unknown properties, `transform` turns payloads into DTO instances) and the shutdown hooks. CORS
 * comes before every guard, so a `401` or a `429` still reaches a browser that is allowed to read it. The
 * authentication guard is not part of it on purpose: an app booted without that line has no authentication, so
 * `main.ts` adds it in plain sight.
 *
 * @param app - the application to configure
 * @param options - the settings that come from the environment; none by default
 */
export const configureApp = (
  app: INestApplication,
  { corsOrigins = [], trustProxyHops = 0 }: AppOptions = {},
): void => {
  if (trustProxyHops > 0) {
    // The platform is Express: with this setting `req.ip` is the address the nearest trusted proxy saw, not what the
    // client wrote in `X-Forwarded-For`.
    const express = app.getHttpAdapter().getInstance() as Express
    express.set('trust proxy', trustProxyHops)
  }

  app.use(helmet({ contentSecurityPolicy: { useDefaults: false, directives: API_CONTENT_SECURITY_POLICY } }))

  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: [...corsOrigins],
      methods: CORS_METHODS,
      allowedHeaders: CORS_ALLOWED_HEADERS,
      exposedHeaders: CORS_EXPOSED_HEADERS,
      // The tokens travel in the body and in `Authorization`; the one cookie is for a navigation to `/api/auth`.
      credentials: false,
      maxAge: CORS_MAX_AGE_SECONDS,
    })
  }

  app.setGlobalPrefix(GLOBAL_PREFIX)
  // Unsigned: the cookies the app sets carry their own signature (e.g. the login checks JWT).
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  // Lets the shutdown hooks run on SIGTERM (Docker/k3s stop): PrismaService and RedisService close their connections.
  app.enableShutdownHooks()
}
