/**
 * Copies an object without its `undefined` properties, typed as optional ones.
 *
 * For a Prisma `data` built from optional input (a PATCH body): with `exactOptionalPropertyTypes` a field left out must
 * be absent, not `undefined`. `null` is a value and stays.
 *
 * @param value - the object to copy
 * @returns a new object with only the properties that are not `undefined`
 */
export const omitUndefined = <T extends Record<string, unknown>>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>
  }
