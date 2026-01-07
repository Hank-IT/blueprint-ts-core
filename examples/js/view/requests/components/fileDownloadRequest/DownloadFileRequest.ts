import {BaseRequest, BlobResponse } from '@hank-it/ui/service/requests'

export default class DownloadFileRequest extends BaseRequest {
    method() {
        return 'GET'
    }

    url() {
        return 'http://localhost:5173/files/7z2404-x64.exe'
    }

    protected getResponse() {
        return new BlobResponse
    }
}