import { type DynamicModule, Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Gives every module of a testing module a `ConfigService` that answers exactly `values`, and nothing else: no `.env`,
 * no `process.env`, no validation. For a spec that boots modules which read the configuration, with the numbers the
 * spec chooses.
 *
 * Not `ConfigModule.forRoot({ validate: () => values })`: that also writes the values into `process.env`, where the next
 * test (or the next app of the same test) finds them.
 *
 * @example
 * Test.createTestingModule({ imports: [ConfigStubModule.with({ RATE_LIMIT_MAX: 3 }), RateLimitModule] })
 */
@Global()
@Module({})
export class ConfigStubModule {
  /**
   * @param values - the configuration, variable name to the value `validateEnv` would return (numbers as numbers)
   * @returns the module to import
   */
  static with(values: Record<string, unknown>): DynamicModule {
    return {
      module: ConfigStubModule,
      providers: [{ provide: ConfigService, useValue: { get: (key: string) => values[key] } }],
      exports: [ConfigService],
    }
  }
}
