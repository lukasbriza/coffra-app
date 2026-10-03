/** Narrows an unknown value (JWT claim, userinfo field, ...) to a string, `undefined` otherwise. */
export const stringOrUndefined = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
