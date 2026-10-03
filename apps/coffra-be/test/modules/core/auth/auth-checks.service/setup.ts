import 'reflect-metadata'

import type { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import type { Env } from '../../../../../src/modules/config'
import { AuthChecksService } from '../../../../../src/modules/core/auth/auth-checks.service'
import type { AuthChecks } from '../../../../../src/modules/core/auth/types'

// Shared by the use case specs of `AuthChecksService` (sign, verify).

export const CHECKS_SECRET = 'checks-secret-with-at-least-32-chars'
export const ACCESS_SECRET = 'access-secret-with-at-least-32-chars'

export const checks: AuthChecks = {
  state: 'expected-state',
  nonce: 'expected-nonce',
  codeVerifier: 'expected-verifier',
}

const configService = { get: () => CHECKS_SECRET } as unknown as ConfigService<Env, true>
export const jwt = new JwtService()
export const service = new AuthChecksService(jwt, configService)

export const base64Url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url')
