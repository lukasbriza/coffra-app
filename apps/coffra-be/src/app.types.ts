/**
 * What `configureApp` takes from the environment. Every property is optional and the defaults are the safe ones, so a
 * test that boots an application without them gets no CORS and no proxy.
 *
 * @property corsOrigins - the browser origins allowed to call the API (`CORS_ORIGINS`); empty or left out: the
 * application sends no CORS headers at all
 * @property trustProxyHops - how many reverse proxies stand in front of the application (`TRUST_PROXY_HOPS`); `0` or
 * left out: the address of the connection is the client, `X-Forwarded-For` is ignored
 */
export type AppOptions = {
  corsOrigins?: readonly string[]
  trustProxyHops?: number
}
