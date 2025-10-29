import { MediaType } from '@prisma/client'
import { Worker } from 'bullmq'
import { env } from './env.js'
import { prisma } from './prisma.js'
import { createRedis } from './redis.js'
import { scrape } from './scraper.js'
import { hashUrl } from './utils.js'

const redis = createRedis()

async function handle(url: string) {
  const { images, videos } = await scrape(url)

  const hash = hashUrl(url)
  const page = await prisma.page.upsert({
    where: { urlHash: hash },
    update: {},
    create: { url, urlHash: hash },
  })

  const uniqImages = [...new Set(images)].filter(Boolean)
  const uniqVideos = [...new Set(videos)].filter(Boolean)

  const rows = [
    ...uniqImages.map((u) => ({
      type: MediaType.image,
      url: u,
      urlHash: hashUrl(u),
      pageId: page.id,
    })),
    ...uniqVideos.map((u) => ({
      type: MediaType.video,
      url: u,
      urlHash: hashUrl(u),
      pageId: page.id,
    })),
  ]

  if (rows.length === 0) return

  const BATCH_SIZE = 500
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await prisma.media.createMany({
      data: rows.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    })
  }
}

new Worker<{ url: string }>(
  env.QUEUE_NAME,
  async (job) => {
    const start = Date.now()
    const { url } = job.data

    console.log(`🚀 [job ${job.id}] start scraping: ${url}`)

    try {
      await handle(job.data.url)
      console.log(`✅ [job ${job.id}] done in ${(Date.now() - start).toFixed(0)}ms`)
    } catch (e) {
      console.error(`❌ [job ${job.id}] failed:`, (e as Error).message)
    }
  },
  {
    connection: redis,
    concurrency: env.WORKER_CONCURRENCY,
  }
)
