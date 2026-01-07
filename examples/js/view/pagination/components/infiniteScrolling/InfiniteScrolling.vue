<template>
    <div class="container" @scroll="scroll">
        <div class="item" v-for="row in paginator.getPageData()">
            {{ row }}
            <br>
        </div>
    </div>
</template>

<script setup lang="ts">
import {GetProductsRequest} from "./GetProductsRequest";
import {InfiniteScroller, RequestDriver, VuePaginationDriverFactory, Paginator} from '@hank-it/ui/service/pagination'
import {VueLoaderDriverFactory, BaseRequest, FetchDriver} from '@hank-it/ui/service/requests'
import {isAtBottom} from '@hank-it/ui/service/helpers'
import { debounce } from 'lodash'

function scroll(event) {
    console.log("scroll")

    if (isAtBottom(event.target.scrollHeight, event.target.scrollTop, event.target.clientHeight)) {
        loadNextDebounced()
    }
}

const loadNextDebounced = debounce(event => {
    paginator.toNextPage()
}, 100)

/* Booting */
BaseRequest.setRequestDriver(new FetchDriver)
BaseRequest.setLoaderStateFactory(new VueLoaderDriverFactory)
Paginator.setViewDriverFactory(new VuePaginationDriverFactory())

/* component */
const getProductsRequest = new GetProductsRequest

const paginator = new InfiniteScroller(new RequestDriver(getProductsRequest))

paginator.init(1, 10)

</script>

<style scoped>
.container {
    overflow: auto;
    border-style: solid;
    border-color: red;
    height: 400px;
    display: flex;
    flex-direction: column;
}

.item {
    margin-top: 10px;
    margin-bottom: 10px;
}
</style>