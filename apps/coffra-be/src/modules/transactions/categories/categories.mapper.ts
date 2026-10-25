import type { Category } from '../../prisma'

import type { CategoryView } from './categories.types'

/**
 * The only way a category row leaves the service.
 *
 * Only the listed fields are copied, so the owner columns (`userId`, `tenantId`) and the timestamps never reach the
 * API.
 *
 * @param row - the category as stored
 * @returns the category as the API shows it
 */
export const toCategoryView = ({ id, name }: Category): CategoryView => ({ id, name })
