import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'

import type { Env } from '../config'

import {
  REDIS_COMMAND_TIMEOUT_MS,
  REDIS_CONNECT_TIMEOUT_MS,
  REDIS_MAX_RETRY_DELAY_MS,
  REDIS_RETRY_DELAY_MS,
} from './constants'

/**
 * The one Redis client of the application (`ioredis`), connected to `REDIS_URL`. The rate limit keeps its counters in
 * it and the health probe checks it.
 *
 * - **Lazy:** it connects with the first command (the first counted request or health check), not at startup. The
 *   start does not wait for Redis, and a test that never sends a command never connects.
 * - **Fails fast:** a command has `REDIS_COMMAND_TIMEOUT_MS` to be answered, and a command that cannot be sent is
 *   given up after one attempt to connect. The connection reconnects by itself in the background.
 * - **No secrets in logs:** `REDIS_URL` can hold a password, so the client's own `error` events are not printed. Whoever
 *   sends a command reports the failure (without the message).
 */
@Injectable()
export class RedisService extends Redis implements OnApplicationShutdown {
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
      retryStrategy: (attempt) => Math.min(attempt * REDIS_RETRY_DELAY_MS, REDIS_MAX_RETRY_DELAY_MS),
    })

    this.on('error', () => {
      // Without a listener ioredis prints every failed attempt, with the address.
    })
  }

  /**
   * Closes the connection when the application stops (after the HTTP server): waits for the commands in flight, or
   * drops the connection when that fails.
   */
  async onApplicationShutdown(): Promise<void> {
    // `wait`: never connected (lazy). `quit()` would connect only to say goodbye.
    if (this.status === 'wait') {
      this.disconnect()

      return
    }

    try {
      await this.quit()
    } catch {
      this.disconnect()
    }
  }
}
