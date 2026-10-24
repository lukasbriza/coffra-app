import { Module } from '@nestjs/common'

/**
 * The dashboard: figures derived from the transactions.
 *
 * Reads data only through the public services of `transactions`, never from its tables. Empty until the first figure
 * is built.
 */
@Module({})
export class DashboardModule {}
