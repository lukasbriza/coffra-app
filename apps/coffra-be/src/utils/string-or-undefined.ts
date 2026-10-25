/**
 * Narrows an unknown value (JWT claim, userinfo field, ...) to a string.
 *
 * @param value - anything
 * @returns the value when it is a string, `undefined` otherwise
 */
export const stringOrUndefined = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
