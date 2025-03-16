import { createPinia } from 'pinia'
import { createApp } from 'vue'

import Aura from '@primevue/themes/aura'
import 'primeicons/primeicons.css'
import PrimeVue from 'primevue/config'

import App from '@/App.vue'
import '@/assets/main.css'
import router from '@/router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.app-dark'
    }
  }
})

app.mount('#app')
