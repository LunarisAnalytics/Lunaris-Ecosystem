import { toolkitBuilder } from '@/ai/core'
import { FETCH_POOL_DATA_KEY } from '@/ai/modules/liquidity/pool-fetcher/key'
import { ANALYZE_POOL_HEALTH_KEY } from '@/ai/modules/liquidity/health-checker/key'
import { FetchPoolDataAction } from '@/ai/modules/liquidity/pool-fetcher/action'
import { AnalyzePoolHealthAction } from '@/ai/modules/liquidity/health-checker/action'

type Toolkit = ReturnType<typeof toolkitBuilder>

/**
 * Toolkit exposing liquidity-related actions:
 * – fetch raw pool data
 * – run health / risk analysis on a liquidity pool
 * – evaluate pool sustainability and risk score
 * – provide combined report across actions
 */
export const LIQUIDITY_ANALYSIS_TOOLS: Record<string, Toolkit> = Object.freeze({
  [`liquidityscan-${FETCH_POOL_DATA_KEY}`]: toolkitBuilder(new FetchPoolDataAction()),
  [`poolhealth-${ANALYZE_POOL_HEALTH_KEY}`]: toolkitBuilder(new AnalyzePoolHealthAction()),
})

/**
 * Helper: build composite analysis from both fetch + health check
 */
export async function runLiquidityAnalysis(poolId: string): Promise<{
  poolData?: any
  healthReport?: any
  success: boolean
  errors?: string[]
}> {
  const errors: string[] = []
  let poolData: any
  let healthReport: any

  try {
    const fetchAction = new FetchPoolDataAction()
    poolData = await fetchAction.execute(poolId)
  } catch (err: any) {
    errors.push(`Pool data fetch failed: ${err?.message || err}`)
  }

  try {
    const healthAction = new AnalyzePoolHealthAction()
    healthReport = await healthAction.execute(poolId)
  } catch (err: any) {
    errors.push(`Health analysis failed: ${err?.message || err}`)
  }

  return {
    poolData,
    healthReport,
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Utility: return all registered liquidity tool keys
 */
export function listLiquidityTools(): string[] {
  return Object.keys(LIQUIDITY_ANALYSIS_TOOLS)
}
