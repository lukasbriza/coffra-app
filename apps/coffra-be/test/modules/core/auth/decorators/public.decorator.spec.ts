import 'reflect-metadata'

import { Controller, Get, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { configureApp } from '../../../../../src/app.setup'
import { IS_PUBLIC_KEY } from '../../../../../src/modules/core/auth/constants'
import { Public } from '../../../../../src/modules/core/auth/decorators/public.decorator'
import { buildSwaggerDocument } from '../../../../../src/swagger.setup'

@Controller('mixed')
class MixedController {
  @Public()
  @Get('open')
  open(): void {
    // a probe route
  }

  @Get('closed')
  closed(): void {
    // a probe route
  }
}

@Public()
@Controller('whole')
class PublicController {
  @Get()
  index(): void {
    // a probe route
  }
}

/** The route handler itself, where the decorators leave their metadata. */
const handlerOf = (method: 'open' | 'closed'): object => Reflect.get(MixedController.prototype, method)

describe('@Public()', () => {
  let app: INestApplication

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [MixedController, PublicController] }).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('marks a method, and only that method', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handlerOf('open'))).toBe(true)
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handlerOf('closed'))).toBeUndefined()
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, MixedController)).toBeUndefined()
  })

  it('marks a whole controller', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PublicController)).toBe(true)
  })

  describe('in the Swagger document', () => {
    it('leaves the global bearer requirement on a route that is not public', () => {
      const document = buildSwaggerDocument(app)

      expect(document.security).toEqual([{ bearer: [] }])
      expect(document.paths['/api/mixed/closed'].get?.security).toBeUndefined()
    })

    it('overrides it with an empty requirement on a public method', () => {
      expect(buildSwaggerDocument(app).paths['/api/mixed/open'].get?.security).toEqual([{}])
    })

    it('overrides it on every route of a public controller', () => {
      expect(buildSwaggerDocument(app).paths['/api/whole'].get?.security).toEqual([{}])
    })
  })
})
