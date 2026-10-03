import 'reflect-metadata'

import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import type { Env } from '../../../../../src/modules/config'
import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'

// Shared by the use case specs of `AuthTokensService` (issue, verifyAccess, verifyRefresh, invalid tokens).

export const ACCESS_SECRET = 'access-secret-with-at-least-32-chars'
export const REFRESH_SECRET = 'refresh-secret-with-at-least-32-chars'
export const CHECKS_SECRET = 'checks-secret-with-at-least-32-chars'
export const ACCESS_TTL = 900
export const REFRESH_TTL = 2_592_000
export const USER_ID = '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11'

const values: Record<string, unknown> = {
  JWT_ACCESS_SECRET: ACCESS_SECRET,
  JWT_REFRESH_SECRET: REFRESH_SECRET,
  JWT_ACCESS_TTL_SECONDS: ACCESS_TTL,
  JWT_REFRESH_TTL_SECONDS: REFRESH_TTL,
}
export const configService = { get: (key: string) => values[key] } as unknown as ConfigService<Env, true>
export const jwt = new JwtService()
export const service = new AuthTokensService(jwt, configService)

type Claims = { sub?: unknown; iat: number; exp: number }
export const decode = (token: string): Claims => jwt.decode<Claims>(token)
export const base64Url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url')
export const nowSeconds = (): number => Math.floor(Date.now() / 1000)
