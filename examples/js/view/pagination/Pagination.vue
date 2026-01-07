<template>
    <DemoPage :components="components" />
</template>

<script setup lang="ts">
import TablePagination from './components/tablePagination/TablePagination.vue'
import ErrorPagination from './components/errorPagination/ErrorPagination.vue'
import InfiniteScrolling from './components/infiniteScrolling/InfiniteScrolling.vue'
import DemoPage from '../layout/DemoPage.vue'

const components = {
    'table-pagination': {
        name: 'Paginated table',
        component: TablePagination,
        route: { name: 'pagination', params: { component: 'table-pagination' } },
    },
    'error-pagination': {
        name: 'Pagination with error',
        component: ErrorPagination,
        route: { name: 'pagination', params: { component: 'error-pagination' } },
    },
    'infinite-scrolling': {
        name: 'Infinite scrolling',
        component: InfiniteScrolling,
        route: { name: 'pagination', params: { component: 'infinite-scrolling' } },
    },
}
</script>