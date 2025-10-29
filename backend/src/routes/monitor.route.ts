import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma.js'
import { createRedis } from '../redis.js'
import { queue } from '../queue.js'

// --- Request count tracking ---
let requestCount = 0
export function incrementRequestCount() {
  requestCount++
  return requestCount
}

// --- Event loop lag tracking ---
let eventLoopLag = 0
setInterval(() => {
  const start = performance.now()
  setImmediate(() => {
    eventLoopLag = performance.now() - start
  })
}, 1000)

// --- CPU tracking ---
let lastCpuUsage = process.cpuUsage()
let lastHrtime = process.hrtime()

// --- Queue delay tracking ---
let avgQueueDelay = 0
let sampleCount = 0
async function recordQueueDelay() {
  try {
    const jobs = await queue.getJobs(['waiting', 'active'])
    if (jobs.length > 0) {
      const now = Date.now()
      const delays = jobs.map((j) => now - j.timestamp)
      const avg = delays.reduce((a, b) => a + b, 0) / delays.length
      avgQueueDelay = (avgQueueDelay * sampleCount + avg) / (sampleCount + 1)
      sampleCount++
    }
  } catch (err) {
    // ignore transient queue errors
  }
}
setInterval(recordQueueDelay, 2000)

export async function monitorRoutes(app: FastifyInstance) {
  // --- Middleware: count all requests ---
  app.addHook('onRequest', (_req, _reply, done) => {
    requestCount++
    done()
  })

  // --- Health check ---
  app.get('/health', async (req, reply) => {
    const redis = createRedis()
    try {
      await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()])
      return reply.code(200).send({ ok: true })
    } catch (err) {
      return reply.code(200).send({
        ok: false,
        error: (err as Error).message,
      })
    } finally {
      redis.disconnect()
    }
  })

  // --- Metrics ---
  app.get('/metrics', async (_req, reply) => {
    const redis = createRedis()

    try {
      const uptime = process.uptime()
      const mem = process.memoryUsage()
      const totalMB = (mem.rss / 1024 / 1024).toFixed(2)
      const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(2)
      const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(2)
      const heapUsedPercent = ((mem.heapUsed / mem.heapTotal) * 100).toFixed(2)

      // --- CPU ---
      const currentCpu = process.cpuUsage(lastCpuUsage)
      const currentHr = process.hrtime(lastHrtime)
      lastCpuUsage = process.cpuUsage()
      lastHrtime = process.hrtime()
      const elapsedMicros = currentHr[0] * 1e6 + currentHr[1] / 1e3
      const userMs = currentCpu.user / 1000
      const systemMs = currentCpu.system / 1000
      const cpuPercent = ((userMs + systemMs) / elapsedMicros) * 100

      // --- Redis ---
      const redisStart = performance.now()
      await redis.ping()
      const redisLatency = performance.now() - redisStart
      const redisInfo = await redis.info('memory')
      const usedMemoryMatch = redisInfo.match(/used_memory_human:(\S+)/)
      const redisMemory = usedMemoryMatch ? usedMemoryMatch[1] : 'N/A'

      // --- Queue ---
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ])

      return reply.code(200).send({
        status: 'ok',
        uptimeSeconds: uptime,
        requestsTotal: requestCount,
        memory: {
          totalMB,
          heapUsedMB,
          heapTotalMB,
          heapUsedPercent: `${heapUsedPercent}%`,
        },
        cpu: {
          userMs: userMs.toFixed(2),
          systemMs: systemMs.toFixed(2),
          usagePercent: `${cpuPercent.toFixed(2)}%`,
        },
        eventLoop: {
          lagMs: eventLoopLag.toFixed(2),
        },
        redis: {
          latencyMs: redisLatency.toFixed(2),
          memory: redisMemory,
        },
        queue: {
          waiting,
          active,
          completed,
          failed,
          avgDelayMs: avgQueueDelay.toFixed(2),
        },
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      return reply.code(500).send({
        status: 'error',
        message: (err as Error).message,
      })
    } finally {
      redis.disconnect()
    }
  })
}
