/** Type guard for values that must be a real string, e.g. a JWT claim (`''` does not count). */
export const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0
