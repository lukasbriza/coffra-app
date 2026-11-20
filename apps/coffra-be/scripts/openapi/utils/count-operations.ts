import type { OpenAPIObject } from '@nestjs/swagger'

import { OPERATION_METHODS } from '../constants'

/**
 * Counts the operations of an OpenAPI document: one per method of each path.
 *
 * @param document - the document
 * @returns how many operations it describes
 */
export const countOperations = ({ paths }: OpenAPIObject): number =>
  Object.values(paths).reduce(
    (count, path) => count + OPERATION_METHODS.filter((method) => path[method] !== undefined).length,
    0,
  )
