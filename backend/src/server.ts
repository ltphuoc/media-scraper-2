import cors from '@fastify/cors'
import Fastify from 'fastify'
import { env } from './env.js'
import authPlugin from './plugins/auth.js'
import { mediaRoutes } from './routes/media.route.js'
import { monitorRoutes } from './routes/monitor.route.js'
import { scrapeRoutes } from './routes/scrape.route.js'

const app = Fastify({
  logger: true,
  bodyLimit: 64 * 1024, // 64 KB

  maxRequestsPerSocket: 0,

  connectionTimeout: 3_000,
  keepAliveTimeout: 60_000,
  requestTimeout: 8_000,

  pluginTimeout: 5_000,
})

// Logging middleware
app.addHook('onRequest', async (req) => {
  req.requestTime = performance.now()
  req.log.info({ method: req.method, url: req.url }, '➡️ Incoming request')
})

app.addHook('onResponse', async (req, reply) => {
  const start = req.requestTime ?? performance.now()
  const duration = (performance.now() - start).toFixed(2)

  req.log.info(
    { method: req.method, url: req.url, statusCode: reply.statusCode, durationMs: duration },
    '⬅️ Response sent'
  )
})

// Error middleware (before setErrorHandler)
app.addHook('onError', async (req, reply, error) => {
  req.log.error({ err: error, method: req.method, url: req.url }, '💥 Request error')
  if (!reply.sent) {
    reply.code(500).send({
      error: 'INTERNAL',
      message: env.NODE_ENV === 'production' ? undefined : error.message,
    })
  }
})

await app.register(cors, {
  origin: env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})

await app.register(monitorRoutes)

await app.register(async (securedApp) => {
  await securedApp.register(authPlugin)
  securedApp.addHook('onRequest', securedApp.basicAuth)

  await securedApp.register(scrapeRoutes)
  await securedApp.register(mediaRoutes)
})

app.setNotFoundHandler((_req, reply) => {
  reply.code(404).send({ error: 'NOT_FOUND' })
})

app.setErrorHandler((err, _req, reply) => {
  app.log.error({ err }, 'unhandled')
  reply.code(500).send({ error: 'INTERNAL' })
})

app.listen({ host: '0.0.0.0', port: env.API_PORT }).catch((e) => {
  app.log.error(e, 'listen_failed')
  process.exit(1)
})
