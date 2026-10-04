/** What the API tells a user about themselves: no `externalSubject`, no `authSource`, no timestamps (ADR 0010). */
export type UserProfile = {
  id: string
  email: string
}

/** Identity as the identity provider asserts it, the input of `UsersService.upsertByExternalSubject`. */
export type UserIdentity = {
  /** OIDC `sub`, maps to `User.externalSubject`. */
  subject: string
  email: string
}
