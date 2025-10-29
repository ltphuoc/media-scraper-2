import basicAuth from '@fastify/basic-auth'
import fp from 'fastify-plugin'
import { env } from '../env.js'

export default fp(async (app) => {
  const user = env.BASIC_AUTH_USER || 'admin'
  const pass = env.BASIC_AUTH_PASS || 'admin'

  app.register(basicAuth, {
    validate(username, password, req, reply, done) {
      if (username === user && password === pass) {
        done()
      } else {
        reply.header('WWW-Authenticate', 'Basic realm="Secure Area"')
        done(new Error('Unauthorized'))
      }
    },
    authenticate: true,
  })
})
