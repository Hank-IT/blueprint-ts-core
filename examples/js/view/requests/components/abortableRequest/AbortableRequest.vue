<template>
    <h1>Abortable request</h1>

    <p v-if="request.isLoading()">Lade...</p>

    <p>Response: {{ data }}</p>

    <button @click="controller.abort()">Abort</button>
</template>

<script setup lang="ts">
import {ref} from "vue";
import {VueLoaderDriverFactory, BaseRequest, FetchDriver} from '@hank-it/ui/service/requests'
import {GetProductsRequest} from './GetProductsRequest'

/* Booting */
BaseRequest.setRequestDriver(new FetchDriver)
BaseRequest.setLoaderStateFactory(new VueLoaderDriverFactory)

/* Component */
const controller = new AbortController();

const data = ref({})

const request = new GetProductsRequest({
    abortSignal: controller.signal,
})

function sendRequest() {
    request.send().then(response => {
        data.value = response.data
    })
}

sendRequest()
</script>