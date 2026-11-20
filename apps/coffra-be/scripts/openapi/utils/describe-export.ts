/**
 * One sentence about an export, for the terminal.
 *
 * @param operations - how many operations the document describes
 * @param file - where it was written, as the caller named it
 * @returns what was written where
 */
export const describeExport = (operations: number, file: string): string =>
  `Wrote the OpenAPI document (${operations} ${operations === 1 ? 'operation' : 'operations'}) to ${file}`
