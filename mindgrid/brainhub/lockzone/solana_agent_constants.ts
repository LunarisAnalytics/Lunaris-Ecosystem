export const SOLANA_KNOWLEDGE_AGENT_ID = 'solana-knowledge-agent' as const

export const SOLANA_KNOWLEDGE_AGENT_VERSION = '1.0.0' as const
export const SOLANA_KNOWLEDGE_AGENT_NAME = 'Solana Knowledge Agent' as const

export function getSolanaKnowledgeAgentInfo() {
  return {
    id: SOLANA_KNOWLEDGE_AGENT_ID,
    name: SOLANA_KNOWLEDGE_AGENT_NAME,
    version: SOLANA_KNOWLEDGE_AGENT_VERSION,
  }
}
