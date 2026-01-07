<template>
    <div>

    </div>
</template>

<script setup lang="ts">
import {ref, computed} from 'vue'
import {VueLoaderDriverFactory, BaseRequest, FetchDriver} from '@hank-it/ui/service/requests'
import DownloadFileRequest from './DownloadFileRequest'

/* Booting */
BaseRequest.setRequestDriver(new FetchDriver)
BaseRequest.setLoaderStateFactory(new VueLoaderDriverFactory)

/* Component */
const request = new DownloadFileRequest

function sendRequest() {
    request.send().then(response => {
        console.log(response)

       // saveBlob(response.data, 'test.exe');
    })
}

function saveBlob(blob, fileName) {
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";

    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
}

sendRequest()
</script>

<style scoped>

</style>