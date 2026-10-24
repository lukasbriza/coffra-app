/**
 * What the API returns for a category: no owner columns (`userId`, `tenantId`), no timestamps.
 *
 * @property id - id of the category (UUID)
 * @property name - name given by the owner; unique per owner and case-sensitive
 */
export type CategoryView = {
  id: string
  name: string
}

/**
 * Input of creating a category.
 *
 * @property name - unique per owner, case-sensitive: `Food` and `food` are two categories
 */
export type CreateCategoryInput = {
  name: string
}

/** Input of changing a category: any field of a create. */
export type UpdateCategoryInput = Partial<CreateCategoryInput>
