import { Global, Module } from '@nestjs/common'

import { RedisService } from './redis.service'

/** The Redis client, available to every module without importing this one (the rate limit, the health probe). */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
