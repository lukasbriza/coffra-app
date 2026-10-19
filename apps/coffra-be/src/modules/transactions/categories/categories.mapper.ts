import type { Category } from '../../prisma'

import type { CategoryView } from './categories.types'

/**
 * The only way a category row leaves the service: the listed fields, nothing else, so the owner columns (`userId`,
 * `tenantId`) and the timestamps never reach the API.
 */
export const toCategoryView = ({ id, name }: Category): CategoryView => ({ id, name })
