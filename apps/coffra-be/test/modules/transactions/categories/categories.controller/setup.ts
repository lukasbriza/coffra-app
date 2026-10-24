import { beforeEach, vi } from 'vitest'

import { CategoriesController } from '../../../../../src/modules/transactions/categories/categories.controller'
import { CategoriesService } from '../../../../../src/modules/transactions/categories/categories.service'
import type { CategoryView } from '../../../../../src/modules/transactions/categories/categories.types'
import { useControllerApp } from '../../use-controller-app'

// Shared by the use case specs of `CategoriesController` (one file per endpoint): the controller behind the real
// guard and `configureApp` (`useControllerApp`), with a mocked `CategoriesService`.

export { OWNER } from '../../use-controller-app'

export const CATEGORY_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f'

export const VIEW: CategoryView = { id: CATEGORY_ID, name: 'Food' }

/**
 * Boots the controller behind the real guard, with a mocked `CategoriesService`. Call it inside a `describe`: it
 * registers the `beforeEach` and `afterEach` for that block.
 */
export const useCategoriesController = () => {
  const categories = {
    list: vi.fn<CategoriesService['list']>(),
    findOne: vi.fn<CategoriesService['findOne']>(),
    create: vi.fn<CategoriesService['create']>(),
    update: vi.fn<CategoriesService['update']>(),
    remove: vi.fn<CategoriesService['remove']>(),
  }

  beforeEach(() => {
    categories.list.mockReset().mockResolvedValue([VIEW])
    categories.findOne.mockReset().mockResolvedValue(VIEW)
    categories.create.mockReset().mockResolvedValue(VIEW)
    categories.update.mockReset().mockResolvedValue(VIEW)
    categories.remove.mockReset().mockResolvedValue()
  })

  return { categories, ...useControllerApp(CategoriesController, CategoriesService, categories) }
}
