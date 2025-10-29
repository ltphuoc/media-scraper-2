import { FastifyInstance } from 'fastify'
import { env } from '../env.js'
import { queue } from '../queue.js'

function validateBody(body: any): string[] | null {
  if (!body || !Array.isArray(body.urls)) return null
  const urls = body.urls
  if (urls.length < 1 || urls.length > 10) return null
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i]
    if (typeof u !== 'string' || u.length > 2048 || !/^https?:\/\//.test(u)) {
      return null
    }
  }
  return urls
}

export async function scrapeRoutes(app: FastifyInstance) {
  app.post('/scrape', async (req, reply) => {
    const urls = validateBody(req.body)

    if (!urls) {
      return reply.code(400).send({ error: 'INVALID_BODY' })
    }

    reply.code(202).send({ accepted: urls.length })

    const jobs = urls.map((url) => ({ name: env.QUEUE_NAME, data: { url } }))

    // queueMicrotask(() => {
    //   void queue.addBulk(jobs).catch((err) => app.log.error({ err }, 'enqueue_failed'))
    // })

    setImmediate(() => {
      void queue.addBulk(jobs).catch((err) => app.log.error({ err }, 'enqueue_failed'))
    })
  })
}
