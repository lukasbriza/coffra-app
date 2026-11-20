/**
 * The id given to a named account or category.
 *
 * @param ids - ids by name
 * @param name - the name a row refers to
 * @param kind - what is looked up, for the message (`account`, `category`)
 * @returns the id
 * @throws Error when no such name exists, i.e. the data refers to something it does not define
 */
export const idOf = (ids: ReadonlyMap<string, string>, name: string, kind: string): string => {
  const id = ids.get(name)

  if (id === undefined) {
    throw new Error(`The data refers to the ${kind} "${name}", which it does not define.`)
  }

  return id
}
