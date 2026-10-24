import { Global, Module } from '@nestjs/common'

import { PrismaService } from './prisma.service'

/** The database client, available to every module without importing this one. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
