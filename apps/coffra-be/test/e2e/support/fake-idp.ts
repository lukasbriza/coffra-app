import { createHash, generateKeyPairSync, randomUUID, type KeyObject } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import { JwtService } from '@nestjs/jwt'

// A small OpenID provider for the e2e specs: discovery, authorization, token, userinfo, JWKS and end session over
// real HTTP on loopback, so the real `OidcAuthProvider` and `openid-client` run unmodified against it.
//
// It checks what a real IdP checks (redirect URI, PKCE, client credentials, single-use codes), so a wrong request
// from the app fails a spec instead of being waved through. It is not Keycloak: it models none of its quirks.

export const CLIENT_ID = 'coffra-e2e'
export const CLIENT_SECRET = 'coffra-e2e-secret'
export const REDIRECT_URI = 'http://localhost:3000/api/auth/callback'

const REALM_PATH = '/realms/test'
const KEY_ID = 'e2e-key'
const ID_TOKEN_TTL_SECONDS = 300

export type FakeUser = {
  sub: string
  email?: string | undefined
  emailVerified?: boolean
  name?: string
}

export type TokenRequest = {
  client: { id: string; secret: string; method: 'basic' | 'post' }
  form: URLSearchParams
}

type Grant = { challenge: string; nonce: string; redirectUri: string; user: FakeUser }

type KeyPair = { privateKey: string; jwk: Record<string, unknown> }

const exportJwk = (key: KeyObject): Record<string, unknown> => ({
  ...key.export({ format: 'jwk' }),
  kid: KEY_ID,
  alg: 'RS256',
  use: 'sig',
})

const createKeyPair = (): KeyPair => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })

  return { privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, jwk: exportJwk(publicKey) }
}

const readBody = async (request: IncomingMessage): Promise<string> => {
  let body = ''
  for await (const chunk of request) {
    body += String(chunk)
  }
  return body
}

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}

/** A claim set to `undefined` means "leave it out": drop those entries before signing or serializing. */
const withoutUndefined = (claims: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(claims).filter(([, value]) => value !== undefined))

export class FakeIdp {
  /** Who the next login authenticates as. */
  user: FakeUser = { sub: 'e2e-subject-1', email: 'dev@coffra.local', emailVerified: true, name: 'Dev User' }
  /** Overrides claims of the next ID tokens. An `undefined` value removes the claim. */
  idTokenClaims: Record<string, unknown> = {}
  /** `end_session_endpoint` is optional in discovery. */
  advertiseEndSession = true
  /** What `/userinfo` answers: the user as authenticated, another subject, or a rejection. */
  userinfo: 'ok' | { sub: string } | 'unauthorized' = 'ok'
  /** What `/token` answers once the request itself is valid. */
  tokenEndpoint: 'ok' | 'invalid_grant' = 'ok'
  /** Every endpoint answers 503, as when the provider is down. */
  down = false

  /** What reached `/auth`, in order. */
  readonly authorizationRequests: URLSearchParams[] = []
  /** What reached `/token`, in order, with the client credentials as received. */
  readonly tokenRequests: TokenRequest[] = []

  private readonly grants = new Map<string, Grant>()
  private readonly accessTokens = new Map<string, FakeUser>()
  private readonly jwt = new JwtService()
  private readonly keys = createKeyPair()

  private constructor(
    private readonly server: Server,
    readonly issuer: string,
  ) {}

  static async start(): Promise<FakeIdp> {
    const server = createServer()
    // 127.0.0.1, not `localhost`: no IPv6 `::1` ambiguity. Port 0: a free one, so parallel workers never collide.
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    const idp = new FakeIdp(server, `http://127.0.0.1:${port}${REALM_PATH}`)
    server.on('request', (request: IncomingMessage, response: ServerResponse) => {
      void idp.handle(request, response)
    })

    return idp
  }

  async stop(): Promise<void> {
    // `fetch` keeps connections alive, and `close()` waits for them.
    this.server.closeAllConnections()
    await new Promise<void>((resolve) =>
      this.server.close(() => {
        resolve()
      }),
    )
  }

  /** Back to a provider nobody has talked to yet, between two specs. */
  reset(): void {
    this.user = { sub: 'e2e-subject-1', email: 'dev@coffra.local', emailVerified: true, name: 'Dev User' }
    this.idTokenClaims = {}
    this.advertiseEndSession = true
    this.userinfo = 'ok'
    this.tokenEndpoint = 'ok'
    this.down = false
    this.authorizationRequests.length = 0
    this.tokenRequests.length = 0
    this.grants.clear()
    this.accessTokens.clear()
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (this.down) {
        sendJson(response, 503, { error: 'temporarily_unavailable' })
        return
      }

      const url = new URL(request.url ?? '/', this.issuer)
      const endpoint = url.pathname.startsWith(REALM_PATH) ? url.pathname.slice(REALM_PATH.length) : undefined

      switch (`${request.method} ${endpoint}`) {
        case 'GET /.well-known/openid-configuration': {
          sendJson(response, 200, this.discovery())
          return
        }
        case 'GET /jwks': {
          sendJson(response, 200, { keys: [this.keys.jwk] })
          return
        }
        case 'GET /auth': {
          this.authorize(url, response)
          return
        }
        case 'POST /token': {
          await this.token(await readBody(request), request, response)
          return
        }
        case 'GET /userinfo': {
          this.userInfo(request, response)
          return
        }
        case 'GET /logout': {
          response.writeHead(200, { 'content-type': 'text/plain' }).end('logged out')
          return
        }
        default: {
          sendJson(response, 404, { error: 'not_found' })
        }
      }
    } catch {
      sendJson(response, 500, { error: 'server_error' })
    }
  }

  private discovery(): Record<string, unknown> {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/auth`,
      token_endpoint: `${this.issuer}/token`,
      userinfo_endpoint: `${this.issuer}/userinfo`,
      jwks_uri: `${this.issuer}/jwks`,
      ...(this.advertiseEndSession ? { end_session_endpoint: `${this.issuer}/logout` } : {}),
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256'],
      authorization_response_iss_parameter_supported: true,
    }
  }

  /** The browser's visit to the IdP: validates the request, "logs the user in" and redirects back with a code. */
  private authorize(url: URL, response: ServerResponse): void {
    const params = url.searchParams
    this.authorizationRequests.push(params)

    const state = params.get('state')
    const nonce = params.get('nonce')
    const challenge = params.get('code_challenge')
    const problem = [
      params.get('response_type') !== 'code' && 'response_type must be code',
      params.get('client_id') !== CLIENT_ID && 'unknown client_id',
      params.get('redirect_uri') !== REDIRECT_URI && 'redirect_uri is not the registered one',
      params.get('code_challenge_method') !== 'S256' && 'code_challenge_method must be S256',
      !challenge && 'code_challenge is missing',
      !params.get('scope')?.split(' ').includes('openid') && 'scope must contain openid',
      !state && 'state is missing',
      !nonce && 'nonce is missing',
    ].find(Boolean)

    if (problem || !state || !nonce || !challenge) {
      sendJson(response, 400, { error: 'invalid_request', error_description: problem })
      return
    }

    const code = randomUUID()
    this.grants.set(code, { challenge, nonce, redirectUri: REDIRECT_URI, user: { ...this.user } })

    const callback = new URL(REDIRECT_URI)
    callback.searchParams.set('code', code)
    callback.searchParams.set('state', state)
    callback.searchParams.set('iss', this.issuer)
    response.writeHead(302, { location: callback.href }).end()
  }

  private async token(body: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
    const form = new URLSearchParams(body)
    const client = this.clientOf(request, form)
    this.tokenRequests.push({ client, form })

    if (client.id !== CLIENT_ID || client.secret !== CLIENT_SECRET) {
      sendJson(response, 401, { error: 'invalid_client' })
      return
    }

    if (form.get('grant_type') !== 'authorization_code') {
      sendJson(response, 400, { error: 'unsupported_grant_type' })
      return
    }

    const code = form.get('code') ?? ''
    const grant = this.grants.get(code)
    this.grants.delete(code) // single use, valid or not

    const verifier = form.get('code_verifier') ?? ''
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    if (
      this.tokenEndpoint === 'invalid_grant' ||
      grant?.redirectUri !== form.get('redirect_uri') ||
      grant.challenge !== challenge
    ) {
      sendJson(response, 400, { error: 'invalid_grant' })
      return
    }

    const accessToken = randomUUID()
    this.accessTokens.set(accessToken, grant.user)
    sendJson(response, 200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ID_TOKEN_TTL_SECONDS,
      id_token: await this.signIdToken(grant),
    })
  }

  private userInfo(request: IncomingMessage, response: ServerResponse): void {
    const bearer = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1]
    const user = bearer ? this.accessTokens.get(bearer) : undefined

    if (this.userinfo === 'unauthorized' || !user) {
      sendJson(response, 401, { error: 'invalid_token' })
      return
    }

    sendJson(
      response,
      200,
      withoutUndefined({
        sub: typeof this.userinfo === 'object' ? this.userinfo.sub : user.sub,
        email: user.email,
        email_verified: user.email === undefined ? undefined : user.emailVerified,
        name: user.name,
      }),
    )
  }

  private clientOf(request: IncomingMessage, form: URLSearchParams): TokenRequest['client'] {
    const basic = /^Basic (\S+)$/.exec(request.headers.authorization ?? '')?.[1]
    if (basic) {
      const [id = '', secret = ''] = Buffer.from(basic, 'base64').toString('utf8').split(':')
      return { id: decodeURIComponent(id), secret: decodeURIComponent(secret), method: 'basic' }
    }

    return { id: form.get('client_id') ?? '', secret: form.get('client_secret') ?? '', method: 'post' }
  }

  private signIdToken({ nonce, user }: Grant): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const claims = withoutUndefined({
      iss: this.issuer,
      aud: CLIENT_ID,
      sub: user.sub,
      email: user.email,
      email_verified: user.email === undefined ? undefined : user.emailVerified,
      name: user.name,
      nonce,
      iat: now,
      exp: now + ID_TOKEN_TTL_SECONDS,
      ...this.idTokenClaims,
    })

    return this.jwt.signAsync(claims, { algorithm: 'RS256', privateKey: this.keys.privateKey, keyid: KEY_ID })
  }
}
