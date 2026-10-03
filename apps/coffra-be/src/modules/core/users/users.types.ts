/** Identity as the identity provider asserts it, the input of `UsersService.upsertByExternalSubject`. */
export type UserIdentity = {
  /** OIDC `sub`, maps to `User.externalSubject`. */
  subject: string
  email: string
}
