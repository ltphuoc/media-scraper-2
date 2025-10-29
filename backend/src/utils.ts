import crypto from 'crypto'

export const MAX_URL_LENGTH = 4000

export function isValidUrlLength(url: string) {
  return typeof url === 'string' && url.length > 0 && url.length <= MAX_URL_LENGTH
}

export function hashUrl(url: string) {
  return crypto.createHash('md5').update(url).digest('hex')
}
