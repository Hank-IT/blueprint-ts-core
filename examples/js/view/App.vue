<template>
    <div class="container">
        <div class="sidebar">
            <ul>
                <li><RouterLink :to="{ name: 'requests' }">Requests</RouterLink></li>
                <li><RouterLink :to="{ name: 'pagination' }">Pagination</RouterLink></li>
            </ul>
        </div>
        <div class="content">
            <RouterView />
        </div>
    </div>
</template>

<script setup>

</script>

<style>
body {
    margin: 0;
    padding:0;
}

.container {
    display: flex;
    flex-direction: row;
}

.sidebar,
.content {
    display: flex;
    flex-direction: column;
    color: black;
    min-height: 500px;
    border-radius: 4px;
    margin: 10px;
}

.sidebar {
    flex-grow: 1;
    min-width: 300px;
}

.content {
    flex-grow: 5;
    min-width: 630px;
}
</style>