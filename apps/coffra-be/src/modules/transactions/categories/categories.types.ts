/** What the API returns for a category: no owner columns (`userId`, `tenantId`), no timestamps. */
export type CategoryView = {
  id: string
  name: string
}

export type CreateCategoryInput = {
  /** Unique per owner, case-sensitive: `Food` and `food` are two categories. */
  name: string
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>
