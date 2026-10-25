import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { CategoriesController } from '../../../../../src/modules/transactions/categories/categories.controller'
import { CategoriesService } from '../../../../../src/modules/transactions/categories/categories.service'

const list = (): Promise<[]> => Promise.resolve([])

describe('CategoriesController dependency injection', () => {
  it('resolves its dependencies through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: { list } }],
    }).compile()

    await expect(moduleRef.get(CategoriesController).list({ userId: 'user-1' })).resolves.toEqual([])
  })
})
