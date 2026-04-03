export interface AgentCapabilities {
  canAnswerProtocolQuestions: boolean
  canAnswerTokenQuestions: boolean
  canDescribeTooling: boolean
  canReportEcosystemNews: boolean
  canPerformRiskAnalysis?: boolean
  canSummarizeOnChainData?: boolean
}

export interface AgentFlags {
  requiresExactInvocation: boolean
  noAdditionalCommentary: boolean
  strictMode?: boolean
  enableDebugLogs?: boolean
}

export const SOLANA_AGENT_CAPABILITIES: Readonly<AgentCapabilities> = Object.freeze({
  canAnswerProtocolQuestions: true,
  canAnswerTokenQuestions: true,
  canDescribeTooling: true,
  canReportEcosystemNews: true,
  canPerformRiskAnalysis: true,
  canSummarizeOnChainData: true,
})

export const SOLANA_AGENT_FLAGS: Readonly<AgentFlags> = Object.freeze({
  requiresExactInvocation: true,
  noAdditionalCommentary: true,
  strictMode: false,
  enableDebugLogs: false,
})

/** Agent profile bundle */
export interface AgentProfile {
  id: string
  name: string
  version: string
  capabilities: AgentCapabilities
  flags: AgentFlags
}

/**
 * Utility: merge default capabilities with overrides
 */
export function buildAgentCapabilities(overrides?: Partial<AgentCapabilities>): AgentCapabilities {
  return { ...SOLANA_AGENT_CAPABILITIES, ...(overrides || {}) }
}

/**
 * Utility: merge default flags with overrides and sanitize booleans
 */
export function buildAgentFlags(overrides?: Partial<AgentFlags>): AgentFlags {
  const merged = { ...SOLANA_AGENT_FLAGS, ...(overrides || {}) }
  return {
    requiresExactInvocation: !!merged.requiresExactInvocation,
    noAdditionalCommentary: !!merged.noAdditionalCommentary,
    strictMode: !!merged.strictMode,
    enableDebugLogs: !!merged.enableDebugLogs,
  }
}

/**
 * Create a full agent profile with optional overrides.
 */
export function createAgentProfile(opts?: {
  id?: string
  name?: string
  version?: string
  capabilities?: Partial<AgentCapabilities>
  flags?: Partial<AgentFlags>
}): AgentProfile {
  return Object.freeze({
    id: opts?.id ?? 'solana-agent',
    name: opts?.name ?? 'Solana Agent',
    version: opts?.version ?? '1.0.0',
    capabilities: buildAgentCapabilities(opts?.capabilities),
    flags: buildAgentFlags(opts?.flags),
  })
}

/**
 * Query helpers
 */
export function hasCapability<K extends keyof AgentCapabilities>(
  caps: AgentCapabilities,
  key: K
): boolean {
  return !!caps[key]
}

export function capabilityList(caps: AgentCapabilities): string[] {
  return Object.entries(caps)
    .filter(([, v]) => !!v)
    .map(([k]) => k)
    .sort()
}

/** Default profile (frozen) */
export const DEFAULT_SOLANA_AGENT_PROFILE: Readonly<AgentProfile> = createAgentProfile()
