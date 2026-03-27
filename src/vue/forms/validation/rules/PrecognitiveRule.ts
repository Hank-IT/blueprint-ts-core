import { BaseRequest } from '../../../../requests/BaseRequest'
import { ValidationException } from '../../../../requests/exceptions/ValidationException'
import { BaseResponse } from '../../../../requests/responses/BaseResponse'
import { BaseRule, type AsyncValidationContext } from './BaseRule'

export interface PrecognitiveValidationErrorBody {
  errors?: Record<string, string[]>
}

export interface PrecognitiveRuleOptions<FormBody extends object> {
  validateOnly?: string[] | ((field: keyof FormBody, state: FormBody) => string[])
  acceptHeader?: string
  resolveErrors?: (body: PrecognitiveValidationErrorBody) => Record<string, string[]>
}

type PrecognitiveRequestFactory = () => BaseRequest<unknown, PrecognitiveValidationErrorBody, unknown, BaseResponse<unknown>, object, object>

export class PrecognitiveRule<FormBody extends object> extends BaseRule<FormBody> {
  public constructor(
    private readonly requestFactory: PrecognitiveRequestFactory,
    private readonly options: PrecognitiveRuleOptions<FormBody> = {}
  ) {
    super()
  }

  public validate(): boolean {
    return true
  }

  public getMessage(): string {
    return ''
  }

  public override getAsyncValidationPaths(field: keyof FormBody, state: FormBody): string[] {
    const validateOnly = this.options.validateOnly

    if (Array.isArray(validateOnly)) {
      return [...validateOnly]
    }

    if (typeof validateOnly === 'function') {
      return validateOnly(field, state)
    }

    return [String(field)]
  }

  public override async validateAsync(_value: unknown, state: FormBody, context: AsyncValidationContext): Promise<Record<string, string[]> | null> {
    const request = this.requestFactory()
    const validateOnly = this.getAsyncValidationPaths(context.field as keyof FormBody, state)

    request.setBody(context.payload)
    request.setHeaders({
      Accept: this.options.acceptHeader ?? 'application/json',
      Precognition: 'true',
      'Precognition-Validate-Only': validateOnly.join(',')
    })

    try {
      await request.send({ resolveBody: false })

      return {}
    } catch (error) {
      if (error instanceof ValidationException) {
        const body = error.getBody()

        return this.options.resolveErrors?.(body) ?? body.errors ?? {}
      }

      throw error
    }
  }
}
