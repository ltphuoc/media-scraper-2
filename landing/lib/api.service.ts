import { axiosInstance } from './axios'

type ScrapeResponse = {
  jobId: string
  status: string
}

export type MediaItem = {
  id: string
  url: string
  type: MediaType
  createdAt: string
}

type GetMediaResponse = {
  data: MediaItem[]
  metadata: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

type Metrics = {
  status: string // ok | error
  uptimeSeconds: number
  requestsTotal: number

  memory: {
    totalMB: string
    heapUsedMB: string
    heapTotalMB: string
    heapUsedPercent: string
  }

  cpu: {
    userMs: string
    systemMs: string
    usagePercent: string
  }

  eventLoop: {
    lagMs: string
  }

  redis: {
    latencyMs: string
    memory: string
  }

  queue: {
    waiting: number
    active: number
    completed: number
    failed: number
    avgDelayMs: string
  }

  timestamp: string
}

export enum MediaType {
  Image = 'image',
  Video = 'video',
}

type getMediaParams = {
  page: number
  limit: number
  type?: MediaType
  search?: string
}

export const apiService = {
  scrape: (urls: string[]): Promise<ScrapeResponse> => axiosInstance.post('/scrape', { urls }),

  getMedia: (params: getMediaParams): Promise<GetMediaResponse> => axiosInstance.get('/media', { params }),

  getMetrics: (): Promise<Metrics> => axiosInstance.get('/metrics'),
}
