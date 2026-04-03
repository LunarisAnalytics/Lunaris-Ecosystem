import type { BaseFlowAction, FlowActionResponse } from './flow_action_base'

export interface AgentContext {
  apiEndpoint: string
  apiKey: string
  timeoutMs?: number
  metadata?: Record<string, any>
}

type AnyAction = BaseFlowAction<any, any, AgentContext>
type ActionSummary = { id: string; summary: string }

export type FlowAgentMiddleware = (args: {
  action: AnyAction
  payload: unknown
  context: AgentContext
}) => Promise<void> | void

export interface FlowAgentOptions {
  /** default timeout applied if ctx.timeoutMs is not provided */
  defaultTimeoutMs?: number
  /** max concurrent execute calls (0/undefined = unlimited) */
  maxConcurrency?: number
  /** optional middleware chain (runs before validation/execute) */
  middleware?: FlowAgentMiddleware[]
  /** callback hooks */
  onResult?<R>(args: { actionId: string; result: FlowActionResponse<R> }): void
  onError?(args: { actionId: string; error: unknown }): void
}

export class FlowAgent {
  private actions = new Map<string, AnyAction>()
  private opts: FlowAgentOptions
  private inFlight = 0
  private queue: Array<() => void> = []

  constructor(options: FlowAgentOptions = {}) {
    this.opts = options
  }

  /** ----- registry ----- */

  register<S, R>(action: BaseFlowAction<S, R, AgentContext>): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Action with id "${action.id}" is already registered.`)
    }
    this.actions.set(action.id, action as AnyAction)
  }

  registerAll(actions: AnyAction[]): void {
    for (const a of actions) this.register(a)
  }

  unregister(id: string): boolean {
    return this.actions.delete(id)
  }

  clear(): void {
    this.actions.clear()
  }

  hasAction(id: string): boolean {
    return this.actions.has(id)
  }

  listActions(): ActionSummary[] {
    return Array.from(this.actions.values()).map(a => ({ id: a.id, summary: a.summary }))
  }

  getAction(id: string): AnyAction | undefined {
    return this.actions.get(id)
  }

  size(): number {
    return this.actions.size
  }

  /** ----- execution ----- */

  async invoke<R>(
    actionId: string,
    payload: unknown,
    ctx: AgentContext
  ): Promise<FlowActionResponse<R>> {
    const action = this.actions.get(actionId)
    if (!action) {
      const res = { notice: '', error: `Unknown action "${actionId}"` } as FlowActionResponse<R>
      this.opts.onResult?.({ actionId, result: res })
      return res
    }

    // concurrency gate
    await this.acquire()

    try {
      // middleware (pre)
      for (const mw of this.opts.middleware ?? []) {
        await mw({ action, payload, context: ctx })
      }

      // validate
      const validation = action.validate(payload)
      if (!validation.valid) {
        const res = {
          notice: 'Validation failed',
          error: validation.errors?.join('; ') || 'Invalid payload',
        } as FlowActionResponse<R>
        this.opts.onResult?.({ actionId, result: res })
        return res
      }

      // execute with timeout
      const timeoutMs = ctx.timeoutMs ?? this.opts.defaultTimeoutMs
      const execPromise = action.execute({ payload: payload as any, context: ctx })
      const result = (await (timeoutMs
        ? withTimeout(execPromise, timeoutMs)
        : execPromise)) as FlowActionResponse<R>

      this.opts.onResult?.({ actionId, result })
      return result
    } catch (err: any) {
      this.opts.onError?.({ actionId, error: err })
      return {
        notice: 'Execution error',
        error: err?.message || 'Unknown error',
      } as FlowActionResponse<R>
    } finally {
      this.release()
    }
  }

  /**
   * Invoke multiple actions (in order). Stops on first error when `stopOnError` is true.
   */
  async invokeMany(
    calls: Array<{ id: string; payload: unknown; ctx: AgentContext }>,
    stopOnError = false
  ): Promise<FlowActionResponse<unknown>[]> {
    const results: FlowActionResponse<unknown>[] = []
    for (const c of calls) {
      const res = await this.invoke(c.id, c.payload, c.ctx)
      results.push(res)
      if (stopOnError && res.error) break
    }
    return results
  }

  /** Simple health check: returns missing ids (if any) */
  checkRegistered(ids: string[]): { ok: boolean; missing: string[] } {
    const missing = ids.filter(id => !this.actions.has(id))
    return { ok: missing.length === 0, missing }
  }

  /** ----- concurrency control ----- */

  private acquire(): Promise<void> {
    const max = this.opts.maxConcurrency ?? 0
    if (!max || this.inFlight < max) {
      this.inFlight++
      return Promise.resolve()
    }
    return new Promise(resolve => {
      this.queue.push(() => {
        this.inFlight++
        resolve()
      })
    })
  }

  private release(): void {
    this.inFlight = Math.max(0, this.inFlight - 1)
    const next = this.queue.shift()
    if (next) next()
  }
}

/** ----- utils ----- */

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    p.then(
      v => {
        clearTimeout(t)
        resolve(v)
      },
      e => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}
