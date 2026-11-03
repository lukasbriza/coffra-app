import 'reflect-metadata'

import { Controller, Get, Injectable, Module, type OnModuleInit } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../../scripts/openapi/build-open-api-document'

/** Stands for a provider that connects when its module starts (`PrismaService`). */
@Injectable()
class ConnectsWhenStarted implements OnModuleInit {
  /** Fails the test when the module is initialised. */
  onModuleInit(): void {
    throw new Error(`${ConnectsWhenStarted.name} was initialised`)
  }
}

@Controller('probe')
class ProbeController {
  @Get()
  index(): void {
    // a probe route
  }
}

@Module({
  controllers: [ProbeController],
  providers: [
    ConnectsWhenStarted,
    // Stands for a provider that connects as soon as it is created.
    {
      provide: 'CONNECTS_WHEN_CREATED',
      useFactory: () => {
        throw new Error('A provider was instantiated')
      },
    },
  ],
})
class ProbeModule {}

describe('buildOpenApiDocument', () => {
  it('builds the document without creating a provider or starting a module', async () => {
    const document = await buildOpenApiDocument(ProbeModule)

    expect(Object.keys(document.paths)).toStrictEqual(['/api/probe'])
  })
})
