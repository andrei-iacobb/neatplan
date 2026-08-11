import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // `prisma generate` is part of postinstall and intentionally works without a
  // deployment secret. Commands that access the database still require DATABASE_URL.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})
