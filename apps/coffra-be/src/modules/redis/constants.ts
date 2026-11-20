/** How long opening a connection to Redis may take, in milliseconds. */
export const REDIS_CONNECT_TIMEOUT_MS = 2000

/** How long one command may take, in milliseconds. Short, so a Redis that hangs does not hold requests for long. */
export const REDIS_COMMAND_TIMEOUT_MS = 250

/** Wait before reconnecting, in milliseconds: this times the attempt number (200, 400, 600, ...). */
export const REDIS_RETRY_DELAY_MS = 200

/** The longest wait before reconnecting, in milliseconds. */
export const REDIS_MAX_RETRY_DELAY_MS = 2000
