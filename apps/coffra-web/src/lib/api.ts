import 'server-only'

import { createApi, type Api } from '@lukasbriza/coffra-api'

import { getServerEnv } from './env'

let api: Api | undefined

/**
 * Returns the app's single client of the coffra API, created on first use.
 *
 * Server only: the browser never calls the API, so neither `API_BASE_URL` nor a token reaches it. The client is
 * created lazily, so importing this module (e.g. while `next build` collects page data) reads no environment.
 *
 * @returns The typed `fetchClient` and `$api` bound to `API_BASE_URL`.
 * @throws {Error} When `API_BASE_URL` is missing or invalid.
 */
export const getApi = (): Api => {
  if (api !== undefined) {
    return api
  }

  api = createApi(getServerEnv().apiBaseUrl)

  return api
}
