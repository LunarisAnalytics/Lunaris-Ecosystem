import { z } from 'zod'

/**
 * Base types for any action in the flow layer.
 */
export type FlowActionSchema = z.ZodObject<z.ZodRawShape>

export interface FlowActionResponse<T> {
  notice: string
  data?: T
  error?: string
  timestamp?: number
}

export interface BaseFlowAction<
  S extends FlowActionSchema,
  R,
  Ctx = unknown
> {
  id: string
  summary: string
  input: S

  /**
   * Execute action with typed payload and context.
   */
  execute(args: {
    payload: z.infer<S>
    context: Ctx
  }): Promise<FlowActionResponse<R>>

  /**
   * Validate payload against schema.
   */
  validate(payload: unknown): { valid: boolean; errors?: string[] }
}

/**
 * Abstract helper with default validation.
 */
export abstract class AbstractFlowAction<
  S extends FlowActionSchema,
  R,
  Ctx = unknown
> implements BaseFlowAction<S, R, Ctx>
{
  constructor(
    public id: string,
    public summary: string,
    public input: S
  ) {}

  abstract execute(args: {
    payload: z.infer<S>
    context: Ctx
  }): Promise<FlowActionResponse<R>>

  validate(payload: unknown): { valid: boolean; errors?: string[] } {
    const result = this.input.safeParse(payload)
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      }
    }
    return { valid: true }
  }
}
