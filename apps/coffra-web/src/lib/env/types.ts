/**
 * Server-only configuration of the web app, read from the process environment.
 */
export type ServerEnv = {
  /**
   * Origin of the coffra API (`API_BASE_URL`), e.g. `http://localhost:3000`. The contract paths already start with
   * `/api/`, so it carries no path.
   */
  apiBaseUrl: string
}
