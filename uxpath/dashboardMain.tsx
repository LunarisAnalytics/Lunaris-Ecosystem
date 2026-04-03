import React, { useCallback, useEffect, useMemo, useState } from 'react'
import SentimentGauge from './SentimentGauge'
import AssetOverviewPanel from './AssetOverviewPanel'
import WhaleTrackerCard from './WhaleTrackerCard'

interface DashboardProps {
  /** primary symbol for sentiment widget */
  symbol?: string
  /** asset id for overview widget */
  assetId?: string
  /** optional API base for overview widget */
  apiBase?: string
  /** auto-refresh interval for the overview widget (ms) */
  overviewRefreshMs?: number
  /** show whale tracker card */
  showWhales?: boolean
  /** optional dashboard title override */
  title?: string
  /** initial theme (light | dark) */
  initialTheme?: 'light' | 'dark'
}

type Theme = 'light' | 'dark'

/** Simple error boundary to keep dashboard resilient */
class WidgetErrorBoundary extends React.Component<
  { label: string; children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message }
  }
  componentDidCatch(err: Error) {
    /* no-op: could be hooked to telemetry */
    console.error('Widget error:', err)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3">
          <div className="font-semibold mb-1">{this.props.label}</div>
          <div className="text-sm">Failed to render widget{this.state.message ? `: ${this.state.message}` : ''}</div>
        </div>
      )
    }
    return this.props.children as React.ReactElement
  }
}

/** Utility: join class names */
const cn = (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' ')

/**
 * Analytics Dashboard
 * - Elaris references removed
 * - adds theme toggle, manual & keyboard refresh (press "r"), and basic status bar
 * - props allow customizing symbol/assetId/apiBase and layout visibility
 */
export const AnalyticsDashboard: React.FC<DashboardProps> = ({
  symbol = 'SOL',
  assetId = 'SOL-01',
  apiBase = '/api',
  overviewRefreshMs,
  showWhales = true,
  title,
  initialTheme = 'light',
}) => {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [refreshKey, setRefreshKey] = useState<number>(0)
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)

  const heading = useMemo(() => title || 'Analytics Dashboard', [title])

  const doRefresh = useCallback(() => {
    setRefreshKey(k => k + 1) // remount child widgets to force re-fetch
    setLastRefresh(Date.now())
  }, [])

  // keyboard shortcut: press "r" to refresh all
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        doRefresh()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doRefresh])

  // document theme toggle (tailwind-friendly; consumer can scope via parent)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

  return (
    <main
      className={cn(
        'min-h-screen p-8 transition-colors',
        theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-100'
      )}
    >
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1
            className={cn(
              'text-4xl font-bold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}
          >
            {heading}
          </h1>
          <p className={cn('mt-2', theme === 'dark' ? 'text-zinc-300' : 'text-gray-600')}>
            Real-time analytics, sentiment monitoring, and whale activity insights
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={doRefresh}
            className={cn(
              'px-3 py-2 rounded border text-sm hover:bg-opacity-80 transition',
              theme === 'dark'
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-800'
                : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
            )}
            aria-label="Refresh all widgets"
            title="Refresh (r)"
          >
            Refresh
          </button>
          <button
            onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
            className={cn(
              'px-3 py-2 rounded border text-sm transition',
              theme === 'dark'
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-800'
                : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
            )}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </header>

      <section
        aria-label="analytics-widgets"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div
          key={`sentiment-${refreshKey}`}
          className={cn(
            'rounded shadow p-4',
            theme === 'dark' ? 'bg-zinc-800 text-zinc-100' : 'bg-white'
          )}
        >
          <h2 className="text-lg font-semibold mb-3">Sentiment Analysis</h2>
          <WidgetErrorBoundary label="Sentiment Analysis">
            <SentimentGauge symbol={symbol} />
          </WidgetErrorBoundary>
        </div>

        <div
          key={`overview-${refreshKey}`}
          className={cn(
            'rounded shadow p-4',
            theme === 'dark' ? 'bg-zinc-800 text-zinc-100' : 'bg-white'
          )}
        >
          <h2 className="text-lg font-semibold mb-3">Asset Overview</h2>
          <WidgetErrorBoundary label="Asset Overview">
            <AssetOverviewPanel
              assetId={assetId}
              apiBase={apiBase}
              refreshIntervalMs={overviewRefreshMs}
            />
          </WidgetErrorBoundary>
        </div>

        {showWhales && (
          <div
            key={`whales-${refreshKey}`}
            className={cn(
              'rounded shadow p-4',
              theme === 'dark' ? 'bg-zinc-800 text-zinc-100' : 'bg-white'
            )}
          >
            <h2 className="text-lg font-semibold mb-3">Whale Tracker</h2>
            <WidgetErrorBoundary label="Whale Tracker">
              <WhaleTrackerCard />
            </WidgetErrorBoundary>
          </div>
        )}
      </section>

      <footer className="mt-8 text-sm">
        <div className={cn('flex items-center justify-between', theme === 'dark' ? 'text-zinc-300' : 'text-gray-600')}>
          <span>
            Last refresh:{' '}
            {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : '—'}
          </span>
          <span>Press “r” to refresh</span>
        </div>
      </footer>
    </main>
  )
}

export default AnalyticsDashboard
