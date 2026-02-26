import { JsonResponse as ParentJsonResponse } from '../../../requests/responses/JsonResponse'
import { type JsonResponseInterface } from '../JsonBaseRequest'

export class JsonResponse<ResourceInterface> extends ParentJsonResponse<JsonResponseInterface<ResourceInterface>> {
  public getData(): ResourceInterface {
    return this.getBody().data
  }
}
