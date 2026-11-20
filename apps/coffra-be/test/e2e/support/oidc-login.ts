import type request from 'supertest'

// The three steps of a login through the identity provider, as a browser takes them: the app sends it to the
// provider, the provider sends it back with a code, the browser follows to the callback of the app. Shared by the e2e
// specs of the auth flow and the main flow scenario of the integration suite; both run them against `FakeIdp`.

/** A browser: its own cookie jar, like the one session of a real user. */
export type Browser = ReturnType<typeof request.agent>

/**
 * What step 1 of a login gives the browser.
 *
 * @property response - the redirect of `GET /api/auth/login`, for its headers
 * @property authorizationUrl - where the app sends the browser: the authorization endpoint of the provider
 * @property checksCookie - the `name=value` part of the login cookie the app set, or `''` when it set none
 */
export type LoginStart = {
  response: request.Response
  authorizationUrl: string
  checksCookie: string
}

/**
 * The `name=value` part of the login cookie in a `Set-Cookie` header, what a browser sends back.
 *
 * @param response - a response of the app
 * @returns `coffra_oidc_checks=<value>`, with an empty value when the response clears the cookie; `undefined` when the
 * response does not set it
 */
export const checksCookiePair = (response: request.Response): string | undefined =>
  ((response.headers['set-cookie'] ?? []) as unknown as string[])
    .find((cookie) => cookie.startsWith('coffra_oidc_checks='))
    ?.split(';', 1)[0]

/**
 * The claims of a JWT the app issued, without verifying anything.
 *
 * @param token - an access or a refresh token
 * @returns the payload, decoded
 */
export const claimsOf = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(token.split('.', 2)[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>

/**
 * Step 1 of a login, `GET /api/auth/login`: the app answers with a redirect to the provider and sets the login cookie.
 *
 * @param as - the browser that logs in; it keeps the cookie for step 3
 * @returns the redirect, the URL the app sends the browser to and the cookie it set
 * @throws Error (an assertion of supertest) when the app does not answer `302`
 */
export const startLogin = async (as: Browser): Promise<LoginStart> => {
  const response = await as.get('/api/auth/login').expect(302)

  return {
    response,
    authorizationUrl: response.headers.location,
    checksCookie: checksCookiePair(response) ?? '',
  }
}

/**
 * Step 2, the browser at the provider: the provider logs its current user in and redirects back.
 *
 * @param authorizationUrl - the URL of step 1
 * @returns the callback URL the provider redirects to, as the provider built it
 * @throws Error when the provider rejects the authorization request
 */
export const authorize = async (authorizationUrl: string): Promise<URL> => {
  const response = await fetch(authorizationUrl, { redirect: 'manual' })
  if (response.status !== 302) {
    throw new Error(`The fake IdP rejected the authorization request: ${response.status} ${await response.text()}`)
  }

  return new URL(response.headers.get('location') ?? '')
}

/**
 * Step 3, the browser follows the redirect: the redirect URI is the app under test, so only path and query matter.
 *
 * @param as - the browser of step 1, with the login cookie in its jar
 * @param callbackUrl - the URL of step 2
 * @returns the request to `GET /api/auth/callback`, not sent yet
 */
export const callback = (as: Browser, callbackUrl: URL): request.Test =>
  as.get(`${callbackUrl.pathname}${callbackUrl.search}`)
