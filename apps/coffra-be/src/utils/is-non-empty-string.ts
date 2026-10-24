/**
 * Tells whether a value is a real string, e.g. a JWT claim (`''` does not count).
 *
 * @param value - anything
 * @returns `true` for a string with at least one character, which narrows `value` to `string`
 */
export const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0
