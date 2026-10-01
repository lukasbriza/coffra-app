import { Module } from '@nestjs/common'

import { AppConfigModule } from './modules/config'
import { HealthModule } from './modules/health'
import { PrismaModule } from './modules/prisma/prisma.module'

@Module({
  imports: [AppConfigModule, PrismaModule, HealthModule],
})
export class AppModule {}
