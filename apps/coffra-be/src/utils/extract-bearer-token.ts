/** `Authorization: Bearer <token>` → `<token>`. The scheme is case-insensitive (RFC 7235), anything else gives `undefined`. */
export const extractBearerToken = (header: string | undefined): string | undefined =>
  /^Bearer +(\S+)$/i.exec(header ?? '')?.[1]
