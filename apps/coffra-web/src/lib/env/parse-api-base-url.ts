/**
 * Validates the `API_BASE_URL` value and normalises it to an origin.
 *
 * @param value - The raw value of `API_BASE_URL`.
 * @returns The origin of the API, without a trailing slash (`http://localhost:3000`).
 * @throws {Error} When the value is missing, is not an absolute `http:`/`https:` URL, or carries a path, a query or a
 *   hash. The message names the variable and the reason, never the value.
 */
export const parseApiBaseUrl = (value: string | undefined): string => {
  if (value === undefined || value.trim() === '') {
    throw new Error('API_BASE_URL is required: set the origin of the coffra API, e.g. http://localhost:3000.')
  }

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('API_BASE_URL must be an absolute URL, e.g. http://localhost:3000.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('API_BASE_URL must use http or https.')
  }

  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error('API_BASE_URL must be an origin only, without a path (the API paths already start with /api/).')
  }

  return url.origin
}
