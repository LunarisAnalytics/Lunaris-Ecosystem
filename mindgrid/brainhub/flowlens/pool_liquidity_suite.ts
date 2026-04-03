import { toolkitBuilder } from '@/ai/core'
import { FETCH_POOL_DATA_KEY } from '@/ai/modules/liquidity/pool-fetcher/key'
import { ANALYZE_POOL_HEALTH_KEY } from '@/ai/modules/liquidity/health-checker/key'
import { FetchPoolDataAction } from '@/ai/modules/liquidity/pool-fetcher/action'
import { AnalyzePoolHealthAction } from '@/ai/modules/liquidity/health-checker/action'

type Toolkit = ReturnType<typeof toolkitBuilder>

/**
 * Extended liquidity toolset:
 * – fetch raw pool data
 * – run health / risk analysis
 * – execute combined checks and reporting
 */
export const EXTENDED_LIQUIDITY_TOOLS: Record<string, Toolkit> = Object.freeze({
  [`liquidityscan-${FETCH_POOL_DATA_KEY}`]: toolkitBuilder(new FetchPoolDataAction()),
  [`poolhealth-${ANALYZE_POOL_HEALTH_KEY}`]: toolkitBuilder(new AnalyzePoolHealthAction()),
})

/**
 * Run a combined sequence: fetch pool data and analyze health.
 */
export async function performExtendedLiquidityCheck(poolId: string): Promise<{
  success: boolean
  data?: any
  health?: any
  errors?: string[]
}> {
  const errors: string[] = []
  let data: any
  let health: any

  try {
    const fetchAction = new FetchPoolDataAction()
    data = await fetchAction.execute(poolId)
  } catch (err: any) {
    errors.push(`Fetch failed: ${err?.message || String(err)}`)
  }

  try {
    const healthAction = new AnalyzePoolHealthAction()
    health = await healthAction.execute(poolId)
  } catch (err: any) {
    errors.push(`Health analysis failed: ${err?.message || String(err)}`)
  }

  return {
    success: errors.length === 0,
    data,
    health,
    errors: errors.length ? errors : undefined,
  }
}

/**
 * Utility: list available extended liquidity tool identifiers.
 */
export function listExtendedLiquidityTools(): string[] {
  return Object.keys(EXTENDED_LIQUIDITY_TOOLS)
}
