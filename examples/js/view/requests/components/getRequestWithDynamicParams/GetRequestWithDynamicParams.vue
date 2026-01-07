<template>
    <h1>Get request with dynamic params</h1>

    <input placeholder="Search" v-model="search">

    <p v-if="request.isLoading()">Lade...</p>

    <table>
        <tr v-for="row in data">
            <td>{{ row.id }}</td>
            <td>{{ row.title }}</td>
            <td>{{ row.description }}</td>
        </tr>
    </table>
</template>

<script setup lang="ts">
import {ref, computed} from 'vue'
import {VueLoaderDriverFactory, BaseRequest, FetchDriver} from '@hank-it/ui/service/requests'
import {GetProductsRequest} from './GetProductsRequest'

/* Booting */
BaseRequest.setRequestDriver(new FetchDriver({
    corsWithCredentials: true,
}))
BaseRequest.setLoaderStateFactory(new VueLoaderDriverFactory)

/* Component */
const internalSearch = ref('')

const search = computed({
    set(value) {
        internalSearch.value = value

        sendRequest()
    },
    get() {
        return internalSearch.value
    }
})

const data = ref({})

const request = new GetProductsRequest

function sendRequest() {
    request.setParams({
        q: search.value,
    }).send().then(response => {
        data.value = response.data
    })
}

sendRequest()
</script>

<style scoped>

</style>