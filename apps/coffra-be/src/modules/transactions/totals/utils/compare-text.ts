/**
 * Compares two strings by their code units, so `'Food'` comes before `'Salary'`, and `'Salary'` before `'food'`
 * (capital letters sort before lower case).
 *
 * Not `localeCompare`: that depends on the ICU data and the locale of the server, so the order would differ between
 * machines.
 *
 * @param a - the first string
 * @param b - the second string
 * @returns a negative number when `a` comes first, a positive one when `b` does, `0` when they are equal
 */
export const compareText = (a: string, b: string): number => {
  if (a < b) {
    return -1
  }

  return a > b ? 1 : 0
}
