<template>
    <h1>Server error request</h1>

    <p v-if="request.isLoading()">Lade...</p>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import { VueLoaderDriverFactory, BaseRequest, FetchDriver, ResponseException, ErrorHandler } from '@hank-it/ui/service/requests'
import {ServerErrorRequest} from './ServerErrorRequest'

/* Booting */
BaseRequest.setRequestDriver(new FetchDriver({
    corsWithCredentials: false
}))
BaseRequest.setLoaderStateFactory(new VueLoaderDriverFactory)

/* Component */
const data = ref({})

const request = new ServerErrorRequest()

function sendRequest() {
    request.send()
        .then(response => {
            data.value = response.data
        })
        .catch((response: ResponseException) => {
            console.log('Specific error handler')

            console.log(response.getError().getStatusCode())
            console.log(response.getError().getHeaders())
            console.log(response.getError().getOriginalError())
            response.getError().getBodyPromise().then(body => {
                console.log(body)
            })
        })
}

// Global error handler
ErrorHandler.registerHandler(error => {
    console.debug("Registered handler")

    console.log(error.getStatusCode())
    console.log(error.getHeaders())
    console.log(error.getOriginalError())
    error.getBodyPromise().then(body => {
        console.log(body)
    })
})

sendRequest()
</script>