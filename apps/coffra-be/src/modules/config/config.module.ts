import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { validateEnv } from './env.validation'

/**
 * Global configuration: reads the environment once at startup, validates it with `validateEnv` and caches the values.
 * An invalid environment stops the application before it listens.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv })],
})
export class AppConfigModule {}
