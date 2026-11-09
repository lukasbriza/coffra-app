/**
 * An amount of whole currency units as the API spells it: a decimal string with four decimal places.
 *
 * @param value - a non-negative whole number
 * @returns e.g. `12500.0000`
 * @throws Error when the value is not a non-negative safe integer
 */
export const wholeAmount = (value: number): string => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`An amount must be a non-negative whole number, got ${value}.`)
  }

  return `${value}.0000`
}
