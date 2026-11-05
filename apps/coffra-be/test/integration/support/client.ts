import request from 'supertest'
import type { App } from 'supertest/types'

/** Requests to the app under test, with or without a token. */
export type Client = {
  get: (path: string) => request.Test
  post: (path: string, body?: object) => request.Test
  patch: (path: string, body: object) => request.Test
  delete: (path: string) => request.Test
}

/**
 * Requests to the app under test, every one with the same `Authorization` header or none.
 *
 * @param server - gives the HTTP server of the app; read at every request, so a client made before the app booted
 * still works
 * @param authorization - the whole value of the header (`Bearer <token>`); left out, the requests carry none
 * @returns the requests
 */
export const createClient = (server: () => App, authorization?: string): Client => {
  const authorize = (test: request.Test): request.Test =>
    authorization === undefined ? test : test.set('Authorization', authorization)

  return {
    get: (path) => authorize(request(server()).get(path)),
    post: (path, body = {}) => authorize(request(server()).post(path)).send(body),
    patch: (path, body) => authorize(request(server()).patch(path)).send(body),
    delete: (path) => authorize(request(server()).delete(path)),
  }
}
