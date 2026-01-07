<template>
    <DemoPage :components="components" />
</template>

<script setup lang="ts">
import GetRequestWithDynamicParams from './components/getRequestWithDynamicParams/GetRequestWithDynamicParams.vue'
import AbortableRequest from './components/abortableRequest/AbortableRequest.vue'
import ServerErrorRequest from './components/serverErrorRequest/ServerErrorRequest.vue'
import FileDownloadRequest from './components/fileDownloadRequest/FileDownloadRequest.vue'
import DemoPage from '../layout/DemoPage.vue'

const components = {
    'get-request-with-dynamic-params': {
        name: 'Get request with dynamic params',
        component: GetRequestWithDynamicParams,
        route: { name: 'requests', params: { component: 'get-request-with-dynamic-params' } },
    },
    'abortable-request': {
        name: 'Abortable request',
        component: AbortableRequest,
        route: { name: 'requests', params: { component: 'abortable-request' } },
    },
    'server-error-request': {
        name: 'Server error request',
        component: ServerErrorRequest,
        route: { name: 'requests', params: { component: 'server-error-request' } },
    },
    'file-download-request': {
        name: 'File download request',
        component: FileDownloadRequest,
        route: { name: 'requests', params: { component: 'file-download-request' } },
    },
}
</script>