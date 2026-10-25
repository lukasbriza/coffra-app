/**
 * What the API tells a user about themselves: no `externalSubject`, no `authSource`, no timestamps.
 *
 * @property id - id of the user (UUID)
 * @property email - email as the identity provider reported it at the last login
 */
export type UserProfile = {
  id: string
  email: string
}

/**
 * Identity as the identity provider asserts it, the input of `UsersService.upsertByExternalSubject`.
 *
 * @property subject - OIDC `sub`, maps to `User.externalSubject`
 * @property email - email address of the user at the provider
 */
export type UserIdentity = {
  subject: string
  email: string
}
