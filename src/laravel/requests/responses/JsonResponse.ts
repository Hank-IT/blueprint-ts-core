import { JsonResponse as ParentJsonResponse } from '../../../service/requests/responses/JsonResponse'
import { type JsonResponseInterface } from '../JsonBaseRequest'

export class JsonResponse<ResourceInterface> extends ParentJsonResponse<JsonResponseInterface<ResourceInterface>> {
  public getData(): ResourceInterface {
    return this.getBody().data
  }
}
