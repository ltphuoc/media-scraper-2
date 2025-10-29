import { Queue } from 'bullmq'
import { env } from '../env.js'
import { createRedis } from '../redis.js'

async function main() {
  const queue = new Queue(env.QUEUE_NAME, { connection: createRedis() })

  try {
    await queue.drain(true)
    await queue.clean(0, 0, 'completed')
    await queue.clean(0, 0, 'failed')
    console.log(`✅ Queue cleared (completed + failed)`)
  } catch (err) {
    console.error('❌ Failed to clear queue:', err)
  } finally {
    await queue.close()
    queue.disconnect()
    process.exit(0) // ⚡️ force exit
  }
}

main()
