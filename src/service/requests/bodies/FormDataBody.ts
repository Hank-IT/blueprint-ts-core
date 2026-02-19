import { type BodyContract } from '../contracts/BodyContract'
import { type HeadersContract } from '../contracts/HeadersContract'
import { isObject } from '../../../helpers'

export class FormDataBody<RequestBody> implements BodyContract {
  protected data: FormData

  public constructor(data: RequestBody) {
    this.data = this.toFormData(data)
  }

  public getContent(): FormData {
    return this.data
  }

  public getHeaders(): HeadersContract {
    return {}
  }

  protected toFormData(data: RequestBody, form: FormData = new FormData(), namespace: string | null = null): FormData {
    for (const property in data) {
      if (Object.prototype.hasOwnProperty.call(data, property)) {
        const formKey = namespace ? namespace + '[' + property + ']' : property

        const value = (data as any)[property]

        // Null is a valid "explicitly empty" value in many APIs.
        // In multipart FormData we encode it as an empty string so the key is still present.
        if (value === null) {
          form.append(formKey, '')
          continue
        }

        // Undefined values should not reach the request layer (BaseForm omits them).
        // Reject explicitly to avoid silently dropping keys.
        if (value === undefined) {
          throw new Error('Unexpected value')
        }

        if (value instanceof Date) {
          form.append(formKey, value.toISOString())
          continue
        }

        // Support arrays via bracket notation: key[0], key[1], ...
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            this.toFormData({ [String(i)]: value[i] } as any, form, formKey)
          }
          continue
        }

        // Files/Blobs should be appended directly (File extends Blob)
        if (typeof Blob !== 'undefined' && value instanceof Blob) {
          form.append(formKey, value)
          continue
        }

        // if the property is an object, use recursivity.
        if (isObject(value)) {
          this.toFormData(value as any, form, formKey)
          continue
        }

        // Primitives: append as strings
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          form.append(formKey, String(value))
          continue
        }

        throw new Error('Unexpected value')
      }
    }

    return form
  }
}
