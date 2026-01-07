<template>
    <select v-model="selectedComponentKey">
        <RouterLink
            v-for="(component, key) in components"
            :key="key"
            :to="component.route"
            custom
            v-slot="{ isActive, href, navigate }"
        >
            <option @click="navigate" :value="key">
                {{ component.name }}
            </option>
        </RouterLink>
    </select>

    <component v-if="selectedComponentKey" :is="components[selectedComponentKey].component" />
</template>

<script setup lang="ts">
import {ref} from 'vue'

const props = defineProps({
    components: {},
    component: String,
})

const selectedComponentKey = ref(props.component)
</script>