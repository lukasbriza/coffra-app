import 'reflect-metadata'

import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { AUTH_PROVIDER, type AuthProviderInterface, CoreModule } from '../../../src/modules/core'
import { OidcAuthProvider } from '../../../src/modules/core/auth/oidc-auth.provider'
import { PrismaService } from '../../../src/modules/prisma'

const config: Record<string, unknown> = {
  NODE_ENV: 'development',
  OIDC_ISSUER_URL: 'http://localhost:8080/realms/coffra',
  OIDC_CLIENT_ID: 'coffra-be',
  OIDC_CLIENT_SECRET: 'coffra-dev-secret',
  OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
}

describe('CoreModule', () => {
  it('provides an AuthProviderInterface under AUTH_PROVIDER, resolved through @Inject', async () => {
    @Global()
    @Module({
      providers: [{ provide: ConfigService, useValue: { get: (key: string) => config[key] } }],
      exports: [ConfigService],
    })
    class ConfigStubModule {}

    // `PrismaModule` is global in the app and `UsersModule` (also part of `CoreModule`) injects its service.
    @Global()
    @Module({ providers: [{ provide: PrismaService, useValue: {} }], exports: [PrismaService] })
    class PrismaStubModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigStubModule, PrismaStubModule, CoreModule],
    }).compile()
    const provider = moduleRef.get<AuthProviderInterface>(AUTH_PROVIDER)

    expect(provider).toBeInstanceOf(OidcAuthProvider)
  })
})
