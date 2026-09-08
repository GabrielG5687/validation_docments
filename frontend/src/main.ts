import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './assets/styles/main.css'
import DefaultLayout from './layouts/DefaultLayout.vue'
import AuthLayout from './layouts/AuthLayout.vue'
import PublicLayout from './layouts/PublicLayout.vue'
import App from './App.vue'
const app = createApp(App); app.use(createPinia()); app.use(router); app.component('DefaultLayout', DefaultLayout); app.component('AuthLayout', AuthLayout); app.component('PublicLayout', PublicLayout); app.mount('#app')
