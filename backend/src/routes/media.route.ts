import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['image', 'video']).optional(),
  search: z.string().max(500).optional().or(z.literal('')),
})

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/media', async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid query', issues: parsed.error.issues })
    }

    const { page, limit, type, search } = parsed.data

    const where: any = {}
    if (type) where.type = type
    if (search) {
      where.OR = [
        { url: { contains: search, mode: 'insensitive' } },
        { page: { url: { contains: search, mode: 'insensitive' } } },
      ]
    }

    try {
      const [items, total] = await Promise.all([
        prisma.media.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: { page: true },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.media.count({ where }),
      ])

      return reply.send({
        data: items,
        metadata: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (err) {
      req.log.error(err)
      return reply.code(500).send({ message: 'Internal Server Error' })
    }
  })
}
