import 'reflect-metadata'

import { Inject, Injectable, Module } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildOpenApiDocument } from '../../../../scripts/openapi/build-open-api-document'

/** Registered nowhere, so whatever needs it cannot be built. */
@Injectable()
class Unregistered {}

@Injectable()
class NeedsUnregistered {
  constructor(@Inject(Unregistered) readonly dependency: Unregistered) {}
}

@Module({ providers: [NeedsUnregistered] })
class BrokenModule {}

describe('buildOpenApiDocument with a module Nest cannot build', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects with the reason and leaves the process running', async () => {
    const abort = vi.spyOn(process, 'abort').mockImplementation(() => {
      throw new Error('process.abort() was called')
    })

    await expect(buildOpenApiDocument(BrokenModule)).rejects.toThrow(
      "Nest can't resolve dependencies of the NeedsUnregistered",
    )
    expect(abort).not.toHaveBeenCalled()
  })
})
