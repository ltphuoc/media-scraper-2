import * as cheerio from 'cheerio'
import { Page } from 'puppeteer'
import { getBrowser } from './browser.js'
import { isValidUrlLength } from './utils.js'

const FETCH_TIMEOUT = 10_000
const PUPPETEER_TIMEOUT = 40_000
const MIN_HTML_LENGTH = 3_000
const NETWORK_IDLE_WAIT = 3_000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function scrape(baseURL: string) {
  let html: string | null = null
  const videoUrls = new Set<string>()
  const imageUrls = new Set<string>()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    const res = await fetch(baseURL, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
      },
    })
    clearTimeout(timeout)

    if (res.ok) html = await res.text()
  } catch (err) {
    console.warn(`Static fetch failed for ${baseURL}:`, (err as Error).message)
  }

  const hasMedia = html ? html.includes('<img') || html.includes('<video') : false
  const looksLikeCSR =
    !html ||
    (html.length < MIN_HTML_LENGTH && !hasMedia) ||
    /(id|class)="(root|app|__next)"/.test(html) ||
    html.includes('data-reactroot') ||
    html.includes('ng-version')

  if (looksLikeCSR || (html && !hasMedia)) {
    console.log(`Detected CSR page → using Puppeteer for ${baseURL}`)

    const result = await renderWithPuppeteer(baseURL)
    html = result.html
    result.videoUrls.forEach((v) => videoUrls.add(v))
    result.imageUrls.forEach((img) => imageUrls.add(img))
  }

  if (!html || html.length === 0) throw new Error(`Cannot load HTML from ${baseURL}`)

  const { images, videos } = extractMedia(html, baseURL)
  const allImages = [...new Set([...images, ...imageUrls])]
  const allVideos = [...new Set([...videos, ...videoUrls])]

  console.log(`Scraped ${images.length} images and ${allVideos.length} videos from ${baseURL}`)

  return { images: allImages, videos: allVideos }
}

async function renderWithPuppeteer(url: string): Promise<{ html: string; videoUrls: string[]; imageUrls: string[] }> {
  const browser = await getBrowser()
  const videoUrls = new Set<string>()
  const imageUrls = new Set<string>()
  let page: Page | null = null

  try {
    page = await browser.newPage()

    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent({ userAgent: USER_AGENT })
    await page.setCacheEnabled(false)
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: url,
    })
    await page.setRequestInterception(true)

    page.on('request', (req) => {
      const type = req.resourceType()
      if (['font'].includes(type)) req.abort().catch(() => {})
      else req.continue().catch(() => {})
    })

    page.on('response', async (res) => {
      try {
        const link = res.url()
        if (!isValidUrlLength(link)) return

        const ct = (res.headers()['content-type'] || '').toLowerCase()

        if (
          ct.includes('video/') ||
          ct.includes('application/x-mpegURL') ||
          ct.includes('application/dash+xml') ||
          ct.includes('application/vnd.apple.mpegurl') ||
          /\.(mp4|webm|ogg|mov|avi|m3u8|mpd)(\?|$)/i.test(link) ||
          link.includes('/video/') ||
          link.includes('/embed/') ||
          link.includes('/stream/') ||
          link.includes('videoplayback') ||
          link.includes('/media/')
        ) {
          videoUrls.add(link)
        }

        if (
          ct.includes('image/') ||
          /\.(webp|jpg|jpeg|png|gif|avif|svg)(\?|$)/i.test(link) ||
          link.includes('i.ytimg.com') ||
          link.includes('/an_webp/')
        ) {
          imageUrls.add(link)
        }
      } catch {}
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PUPPETEER_TIMEOUT }).catch(() => {})
    await page.waitForSelector('body', { visible: true, timeout: 10000 }).catch(() => {})
    await autoScroll(page).catch(() => {})
    await hoverDynamicMediaTargets(page, { limit: 36, waitPerHoverMs: 120 }).catch(() => {})

    await page.exposeFunction('onMediaFound', (src: string) => {
      if (src && src.startsWith('http')) videoUrls.add(src)
    })

    await page.evaluate(() => {
      const report = (src?: string) => {
        if (src) (window as any).onMediaFound(src).catch(() => {})
      }

      const scan = (el: HTMLMediaElement) => {
        if (el.src) report(el.src)
        if (el.currentSrc) report(el.currentSrc)

        new MutationObserver(() => {
          if (el.src) report(el.src)
          if (el.currentSrc) report(el.currentSrc)
        }).observe(el, { attributes: true, attributeFilter: ['src'] })
      }

      document.querySelectorAll('video, audio').forEach((v) => scan(v as HTMLMediaElement))

      new MutationObserver((muts) => {
        muts.forEach((m) =>
          m.addedNodes.forEach((n) => {
            if (n instanceof HTMLVideoElement || n instanceof HTMLAudioElement) scan(n)
          })
        )
      }).observe(document.body, { childList: true, subtree: true })
    })

    await new Promise((resolve) => setTimeout(resolve, NETWORK_IDLE_WAIT))

    const domVideoLinks = await page.evaluate(() => {
      const urls = new Set<string>()

      document
        .querySelectorAll(
          'video, source, a, iframe, script, [data-video-url], [data-src], [data-stream-url], [data-url], [data-href], [data-video]'
        )
        .forEach((el) => {
          const attrs = [
            'src',
            'href',
            'data-src',
            'data-video-url',
            'data-video',
            'data-stream-url',
            'data-url',
            'data-href',
          ]

          for (const attr of attrs) {
            const val = (el as any).getAttribute?.(attr)
            if (val && /\.(mp4|webm|ogg|mov|avi|m3u8|mpd)(\?|#|$)/i.test(val)) urls.add(val)
          }
          if (el.tagName === 'SCRIPT') {
            const txt = el.textContent || ''
            const matches = txt.match(/https?:\/\/[^"'\s]+\.(mp4|webm|ogg|mov|avi|m3u8|mpd)([?#][^"'\s]*)?/gi)
            matches?.forEach((m) => urls.add(m))
          }
        })

      const MAX_NODES = 2000
      Array.from(document.querySelectorAll<HTMLElement>('*'))
        .slice(0, MAX_NODES)
        .forEach((el) => {
          const names = el.getAttributeNames?.() || []
          for (const name of names) {
            if (!/^data-.*(src|url|href)$/i.test(name)) continue
            const v = el.getAttribute(name) || ''
            if (v && /\.(mp4|webm|ogg|mov|avi|m3u8|mpd)(\?|#|$)/i.test(v)) urls.add(v)
          }
        })

      return Array.from(urls)
    })

    domVideoLinks.forEach((u) => {
      try {
        const abs = new URL(u, url).toString()
        if (isValidUrlLength(abs)) videoUrls.add(abs)
      } catch {
        if (isValidUrlLength(u)) videoUrls.add(u)
      }
    })

    let html = ''
    try {
      html = await page.content()
    } catch (e: any) {
      if (e.message?.includes('detached')) {
        console.warn('[scrape] Frame detached, retrying get content...')
        try {
          await page.waitForSelector('body', { timeout: 5000 })
          html = await page.evaluate(() => document.documentElement.outerHTML)
        } catch (e2) {
          html = ''
        }
      } else {
        throw e
      }
    }

    return { html, videoUrls: [...videoUrls], imageUrls: [...imageUrls] }
  } catch (e) {
    console.error(`Puppeteer render failed: ${(e as Error).message}`)
    return { html: '', videoUrls: [...videoUrls], imageUrls: [...imageUrls] }
  } finally {
    if (page) {
      try {
        await page.close()
      } catch {}
    }
  }
}

async function autoScroll(page: Page, maxScroll = 8000, step = 300) {
  try {
    await page.evaluate(
      async (maxScroll, step) => {
        await new Promise<void>((resolve) => {
          let total = 0
          const timer = setInterval(() => {
            const oldHeight = document.body.scrollHeight
            window.scrollBy(0, step)
            total += step

            if (total >= oldHeight || total >= maxScroll) {
              clearInterval(timer)
              resolve()
            }
          }, 100)
        })
      },
      maxScroll,
      step
    )
  } catch {}
}

async function hoverDynamicMediaTargets(page: Page, opts: { limit?: number; waitPerHoverMs?: number } = {}) {
  const limit = opts.limit ?? 36
  const waitPerHoverMs = opts.waitPerHoverMs ?? 120

  await page.evaluate((max) => {
    const markAttr = 'data-hover-candidate'
    let marked = 0

    const isVid = (s: string | null | undefined) =>
      !!s &&
      (/(\.mp4|\.webm|\.m3u8|\.mpd|\.mov|\.ogg|\.avi)(\?|#|$)/i.test(s) ||
        /(^|\/)(video|videos|media|stream|embed)(\/|$)/i.test(s))

    const isPreviewImg = (s: string | null | undefined) =>
      !!s && (/(\.webp|\.gif)(\?|#|$)/i.test(s) || /(thumb|preview)/i.test(s))

    const tryMark = (el: Element) => {
      if (marked >= max) return
      if (!el.hasAttribute(markAttr)) {
        el.setAttribute(markAttr, '1')
        marked++
      }
    }

    document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
      if (marked >= max) return
      const href = a.getAttribute('href') || a.getAttribute('data-href') || a.getAttribute('data-src') || ''
      if (isVid(href)) tryMark(a)
    })

    document
      .querySelectorAll<HTMLImageElement>(
        'img[src],img[data-src],img[data-lazy-src],img[data-original],img[data-thumb]'
      )
      .forEach((img) => {
        if (marked >= max) return
        const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || ''
        if (isPreviewImg(src)) {
          const target = img.closest('a,button,div,[role="link"]') || img
          tryMark(target)
        }
      })
  }, limit)

  const handles = await page.$$('[data-hover-candidate="1"]')
  const visible: typeof handles = []
  for (const h of handles) {
    const box = await h.boundingBox()
    if (!box || box.width < 4 || box.height < 4) continue
    const ok = await h.evaluate((el) => {
      const cs = getComputedStyle(el as Element)
      return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.01
    })
    if (ok) visible.push(h)
  }

  for (const el of visible.slice(0, limit)) {
    try {
      await el.evaluate((n) => (n as HTMLElement).scrollIntoView({ block: 'center', inline: 'center' }))
      const box = await el.boundingBox()
      if (!box) continue
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 })

      await page
        .waitForResponse(
          (res) => {
            const url = res.url().toLowerCase()
            const ct = (res.headers()['content-type'] || '').toLowerCase()
            return (
              ct.startsWith('image/webp') ||
              ct.startsWith('image/gif') ||
              /\.webp(\?|#|$)/.test(url) ||
              /\.gif(\?|#|$)/.test(url) ||
              ct.startsWith('video/') ||
              /\.m3u8(\?|#|$)/.test(url) ||
              /\.mpd(\?|#|$)/.test(url) ||
              /\.mp4(\?|#|$)/.test(url)
            )
          },
          { timeout: 1200 }
        )
        .catch(() => {})

      await new Promise((resolve) => setTimeout(resolve, waitPerHoverMs))
    } catch {}
  }

  // 4) Dọn cờ
  await page.evaluate(() => {
    document.querySelectorAll('[data-hover-candidate]').forEach((el) => el.removeAttribute('data-hover-candidate'))
  })
}

function extractMedia(html: string, baseURL: string) {
  const $ = cheerio.load(html)

  const keep = (u: string | null, includeDataUri = false) =>
    !!u && isValidUrlLength(u) && (includeDataUri || !u.startsWith('data:'))

  const absolutify = (src: string) => {
    if (!src) return null
    try {
      return new URL(src, baseURL).toString()
    } catch {
      return null
    }
  }

  const images = new Set<string>()
  const videos = new Set<string>()

  const parseSrcset = (v?: string) =>
    (v || '')
      .split(',')
      .map((s) => s.trim().split(/\s+/)[0])
      .filter(Boolean)

  $('img').each((_i, el) => {
    const src =
      $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('data-original') || ''

    parseSrcset($(el).attr('srcset')).forEach((c) => {
      const abs = absolutify(c)
      if (abs && keep(abs)) images.add(abs)
    })

    const abs = absolutify(src)
    if (abs && keep(abs)) images.add(abs)
  })

  $('picture source[srcset]').each((_i, el) => {
    parseSrcset($(el).attr('srcset')).forEach((c) => {
      const abs = absolutify(c)
      if (abs && !abs.startsWith('data:')) images.add(abs)
    })
  })

  $(
    'meta[property="og:image"], meta[property="og:image:url"], meta[property="og:image:secure_url"], meta[name="twitter:image"]'
  ).each((_i, el) => {
    const abs = absolutify($(el).attr('content') || '')
    if (abs && !abs.startsWith('data:')) images.add(abs)
  })

  $('link[rel="preload"][as="image"][href]').each((_i, el) => {
    const abs = absolutify($(el).attr('href') || '')
    if (abs && !abs.startsWith('data:')) images.add(abs)
  })

  $('video, source, a[href], iframe[src]').each((_i, el) => {
    const src =
      $(el).attr('src') ||
      $(el).attr('href') ||
      $(el).attr('data-src') ||
      $(el).attr('data-lazy-src') ||
      $(el).attr('data-video-url') ||
      ''
    const lower = src.toLowerCase()

    if (
      /\.(mp4|webm|ogg|mov|avi|m3u8|mpd)(\?|#|$)/.test(lower) ||
      lower.includes('/video/') ||
      lower.includes('/embed/') ||
      lower.includes('/stream/') ||
      lower.includes('/media/') ||
      lower.includes('videoplayback')
    ) {
      const abs = absolutify(src)
      if (abs) videos.add(abs)
    }
  })

  $(
    'meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"], meta[name="twitter:player:stream"]'
  ).each((_i, el) => {
    const abs = absolutify($(el).attr('content') || '')
    if (abs) videos.add(abs)
  })

  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const data = JSON.parse($(el).text() || 'null')
      const collect = (node: any) => {
        if (!node || typeof node !== 'object') return
        const img = node.image || node.thumbnailUrl
        const vid = node.contentUrl || node.embedUrl
        ;[].concat(img || []).forEach((u: string) => {
          const abs = absolutify(u)
          if (abs && !abs.startsWith('data:')) images.add(abs)
        })
        if (typeof vid === 'string') {
          const abs = absolutify(vid)
          if (abs) videos.add(abs)
        }
        Object.values(node).forEach(collect)
      }
      collect(data)
    } catch {}
  })

  return {
    images: [...images].filter(Boolean),
    videos: [...videos].filter(Boolean),
  }
}
