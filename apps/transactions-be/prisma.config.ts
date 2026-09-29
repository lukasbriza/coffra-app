import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    url: process.env.DATABASE_URL ?? '',
  },
})
