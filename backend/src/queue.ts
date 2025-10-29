import { Queue } from 'bullmq'
import { env } from './env.js'
import { createRedis } from './redis.js'

const connection = createRedis()

export const queue = new Queue(env.QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
    attempts: 1,
  },
})
