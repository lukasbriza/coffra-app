/**
 * How long the database transaction that deletes a user may run, in milliseconds.
 *
 * The default of Prisma (5 s) is too short for a large ledger; past this limit the deletion is rolled back.
 */
export const USER_DELETION_TIMEOUT_MS = 30_000

/** Longest `confirm` accepted when deleting a user: the longest email address (RFC 5321). */
export const CONFIRMATION_MAX_LENGTH = 320
