/**
 * Reads the token from an `Authorization: Bearer <token>` header.
 *
 * The scheme is case-insensitive (RFC 7235).
 *
 * @param header - the value of the `Authorization` header, `undefined` when there is none
 * @returns the token, or `undefined` for any other scheme or shape
 */
export const extractBearerToken = (header: string | undefined): string | undefined =>
  /^Bearer +(\S+)$/i.exec(header ?? '')?.[1]
