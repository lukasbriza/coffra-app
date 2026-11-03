/**
 * Copies a JSON value with the keys of every object in code unit order, at every depth.
 *
 * Arrays keep their order: in an OpenAPI document the order of the parameters, the required properties and the enum
 * values is what a generated client follows. Code units, not `localeCompare`, so the order is the same on every
 * machine whatever its locale. The input is not changed.
 *
 * @param value - a value as `JSON.parse` gives it
 * @returns the same value with sorted keys
 */
export const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeys(item))
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>

  // Without a compare function the keys are compared by their UTF-16 code units.
  return Object.fromEntries(
    Object.keys(record)
      .toSorted()
      .map((key) => [key, sortKeys(record[key])]),
  )
}
