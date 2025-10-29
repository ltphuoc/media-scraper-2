import { z } from 'zod'
import 'dotenv/config'

const Env = z.object({
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.url(),
  QUEUE_NAME: z.string().default('scrape'),
  WORKER_CONCURRENCY: z.coerce.number().min(1).default(2),
  BASIC_AUTH_USER: z.string().default('admin'),
  BASIC_AUTH_PASS: z.string().default('admin'),
  CORS_ORIGIN: z.string().optional(),
  NODE_ENV: z.string(),
  LOG_LEVEL: z.string().optional(),
})
export const env = Env.parse(process.env)
