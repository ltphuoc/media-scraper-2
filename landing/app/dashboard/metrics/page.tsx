'use client'

import { apiService } from '@/lib/api.service'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

const INTERVALS = [1000, 2000, 5000, 10000]

export default function MetricsPage() {
  const [interval, setInterval] = useState(INTERVALS[2])

  const {
    data: metrics,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: ['metrics'],
    queryFn: apiService.getMetrics,
    refetchInterval: interval,
    refetchOnWindowFocus: true,
  })

  if (isLoading) return <div className="p-6 text-gray-600">Loading metrics...</div>
  if (isError) return <div className="p-6 text-red-600">{(error as Error).message}</div>
  if (!metrics) return null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">
          📊 System Metrics {isFetching && <span className="text-xs text-blue-500 animate-pulse">(refreshing...)</span>}
        </h1>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <label htmlFor="interval">Refresh every:</label>
          <select
            id="interval"
            className="border rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring focus:ring-blue-200"
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
          >
            {INTERVALS.map((i) => (
              <option key={i} value={i}>
                {i / 1000} s
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-500 text-right">
        Last updated:{' '}
        <span className="font-medium">
          {(() => {
            const d = new Date(metrics.timestamp)
            const pad = (n: number) => n.toString().padStart(2, '0')
            const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
            const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
            return `${date}, ${time}`
          })()}
        </span>
      </p>

      <Section title="General">
        <MetricRow label="Status" value={metrics.status} />
        <MetricRow label="Uptime (s)" value={metrics.uptimeSeconds.toFixed(1)} />
        <MetricRow label="Requests Total" value={metrics.requestsTotal.toString()} />
      </Section>

      <Section title="Memory">
        <MetricRow label="Total" value={`${metrics.memory.totalMB} MB`} />
        <MetricRow label="Heap Used" value={`${metrics.memory.heapUsedMB} MB`} />
        <MetricRow label="Heap Total" value={`${metrics.memory.heapTotalMB} MB`} />
        <MetricRow label="Heap Used %" value={metrics.memory.heapUsedPercent} />
      </Section>

      <Section title="CPU">
        <MetricRow label="User Time (ms)" value={metrics.cpu.userMs} />
        <MetricRow label="System Time (ms)" value={metrics.cpu.systemMs} />
        <MetricRow label="Usage %" value={metrics.cpu.usagePercent} />
      </Section>

      <Section title="Event Loop">
        <MetricRow label="Lag (ms)" value={metrics.eventLoop.lagMs} />
      </Section>

      <Section title="Redis">
        <MetricRow label="Latency (ms)" value={metrics.redis.latencyMs} />
        <MetricRow label="Memory Used" value={metrics.redis.memory} />
      </Section>

      <Section title="Queue">
        <MetricCard label="Waiting" value={metrics.queue.waiting.toString()} />
        <MetricCard label="Active" value={metrics.queue.active.toString()} />
        <MetricCard label="Completed" value={metrics.queue.completed.toString()} />
        <MetricCard label="Failed" value={metrics.queue.failed.toString()} />
        {/* <MetricRow label="Avg Delay (ms)" value={metrics.queue.avgDelayMs} /> */}
      </Section>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded-lg shadow-sm p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-800">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 space-y-3">
      <h2 className="font-semibold text-gray-700 border-b pb-2">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{children}</div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  )
}
