import { createApp } from 'vue'
import App from './view/App.vue'
import Router from './router'

const app = createApp(App)
    .use(Router)

app.mount('#app')
