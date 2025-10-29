import IORedis from 'ioredis'
import { env } from './env.js'

export function createRedis() {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    keepAlive: 10000,
    connectTimeout: 5000,
    commandTimeout: 10000,
  })
}
