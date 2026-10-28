/**
 * Finds the currency of the account a group of transactions is on.
 *
 * @param accountId - id of the account of the group
 * @param currencies - currency of every account that was read, by account id
 * @returns the currency, three capital letters
 * @throws Error when the account was not read: the sums only refer to accounts of the owner, which exist, so this is a
 * broken invariant and not a client error
 */
export const currencyOf = (accountId: string, currencies: ReadonlyMap<string, string>): string => {
  const currency = currencies.get(accountId)

  if (currency === undefined) {
    throw new Error('A group of transactions belongs to an account that was not read')
  }

  return currency
}
