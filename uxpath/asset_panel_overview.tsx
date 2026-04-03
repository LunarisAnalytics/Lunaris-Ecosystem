import React, { useEffect, useMemo, useRef, useState } from 'react'

interface AssetOverviewPanelProps {
  assetId: string
  /** Optional API base (default: '/api') */
  apiBase?: string
  /** Auto-refresh interval in ms (optional) */
  refreshIntervalMs?: number
  /** Locale for number formatting (default: 'en-US') */
  locale?: string
  /** Currency code for price formatting (default: 'USD') */
  currency?: string
  /** Optional CSS class */
  className?: string
  /** Enable simple sessionStorage caching */
  enableCache?: boolean
  /** Cache TTL in ms (default: 30s) */
  cacheTtlMs?: number
  /** Callbacks */
  onLoad?: (data: AssetOverview) => void
  onError?: (message: string) => void
}

interface AssetOverview {
  name: string
  priceUsd: number
  supply: number
  holders: number
}

type LoadState = 'idle' | 'loading' | 'success' | 'error'

const formatCurrency = (value: number, locale = 'en-US', currency = 'USD') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 6,
  }).format(value || 0)

const formatNumber = (value: number, locale = 'en-US') =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value || 0)

export const AssetOverviewPanel: React.FC<AssetOverviewPanelProps> = ({
  assetId,
  apiBase = '/api',
  refreshIntervalMs,
  locale = 'en-US',
  currency = 'USD',
  className,
  enableCache = false,
  cacheTtlMs = 30_000,
  onLoad,
  onError,
}) => {
  const [info, setInfo] = useState<AssetOverview | null>(null)
  const [state, setState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const controllerRef = useRef<AbortController | null>(null)

  const endpoint = useMemo(() => {
    const base = apiBase.replace(/\/+$/, '')
    return `${base}/assets/${encodeURIComponent(assetId)}`
  }, [apiBase, assetId])

  const cacheKey = useMemo(() => `asset_overview:${endpoint}`, [endpoint])

  const loadFromCache = (): AssetOverview | null => {
    if (!enableCache) return null
    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { ts: number; data: AssetOverview }
      if (Date.now() - parsed.ts > cacheTtlMs) return null
      return parsed.data
    } catch {
      return null
    }
  }

  const saveToCache = (data: AssetOverview) => {
    if (!enableCache) return
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }))
    } catch {
      // ignore quota errors
    }
  }

  const fetchInfo = async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setState('loading')
    setError(null)

    // try cache first (optimistic UI)
    const cached = loadFromCache()
    if (cached && !info) {
      setInfo(cached)
      setState('success')
      setLastUpdated(Date.now())
      onLoad?.(cached)
    }

    try {
      const res = await fetch(endpoint, { signal: controller.signal })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`)
      }
      const json = (await res.json()) as AssetOverview
      setInfo(json)
      setState('success')
      setLastUpdated(Date.now())
      saveToCache(json)
      onLoad?.(json)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      const msg = err?.message || 'Failed to load asset overview'
      setError(msg)
      setState('error')
      onError?.(msg)
    }
  }

  useEffect(() => {
    fetchInfo()
    return () => controllerRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  useEffect(() => {
    if (!refreshIntervalMs) return
    const id = window.setInterval(fetchInfo, refreshIntervalMs)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshIntervalMs, endpoint])

  if (state === 'loading' && !info) {
    return (
      <div className={`p-4 bg-white rounded shadow animate-pulse ${className ?? ''}`} aria-busy="true">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-60 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-56 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-44 bg-gray-200 rounded" />
      </div>
    )
  }

  if (state === 'error' && !info) {
    return (
      <div className={`p-4 bg-white rounded shadow ${className ?? ''}`}>
        <h2 className="text-xl font-semibold mb-2">Asset Overview</h2>
        <p className="text-red-600 mb-3" role="alert">
          Failed to load: {error}
        </p>
        <button
          onClick={fetchInfo}
          className="px-3 py-2 rounded bg-gray-900 text-white hover:bg-black transition"
          aria-label="Retry loading asset overview"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <section className={`p-4 bg-white rounded shadow ${className ?? ''}`} aria-live="polite">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Asset Overview</h2>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-500" title={new Date(lastUpdated).toISOString()}>
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <span className="text-xs text-gray-500">
            {state === 'loading' ? 'Refreshing…' : 'Up to date'}
          </span>
          <button
            onClick={fetchInfo}
            className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
            aria-label="Refresh asset overview"
            disabled={state === 'loading'}
          >
            Refresh
          </button>
        </div>
      </div>

      <dl className="space-y-1">
        <div className="flex gap-2">
          <dt className="font-semibold w-48">ID</dt>
          <dd className="flex-1 break-all">{assetId}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold w-48">Name</dt>
          <dd className="flex-1">{info?.name ?? '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold w-48">Price (USD)</dt>
          <dd className="flex-1">{formatCurrency(info?.priceUsd ?? 0, locale, currency)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold w-48">Circulating Supply</dt>
          <dd className="flex-1">{formatNumber(info?.supply ?? 0, locale)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold w-48">Holders</dt>
          <dd className="flex-1">{formatNumber(info?.holders ?? 0, locale)}</dd>
        </div>
      </dl>
    </section>
  )
}

export default AssetOverviewPanel
