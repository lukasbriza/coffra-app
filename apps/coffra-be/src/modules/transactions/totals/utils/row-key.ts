/**
 * Builds the key that says which row a group belongs to: all groups with the same currency and the same category end
 * up in the same row.
 *
 * @param currency - currency of the group
 * @param categoryId - id of the category of the group; `null` for transactions that have none
 * @returns a string that is the same for the same currency and category, and different otherwise
 */
export const rowKey = (currency: string, categoryId: string | null): string =>
  // A category id is a UUID, so the empty string used for "no category" cannot clash with one.
  `${currency}:${categoryId ?? ''}`
