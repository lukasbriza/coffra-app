import type { OpenAPIObject } from '@nestjs/swagger'

import { sortKeys } from './utils/sort-keys'

/**
 * Writes an OpenAPI document as the text of the exported file, the same for the same document every time.
 *
 * The keys of every object are sorted and arrays keep their order, so the file does not change when only the order of
 * modules, controllers or decorators does. Two spaces of indentation, `\n` line endings on every system (never the
 * line ending of the platform) and one `\n` at the end.
 *
 * @param document - the document
 * @returns the text of the file
 */
export const serializeOpenApi = (document: OpenAPIObject): string => `${JSON.stringify(sortKeys(document), null, 2)}\n`
