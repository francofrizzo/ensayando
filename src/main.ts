import { createPinia } from 'pinia'
import { createApp } from 'vue'

import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'

import App from '@/App.vue'
import '@/assets/main.css'
import router from '@/router'
import { definePreset } from '@primevue/themes'

import { inject } from '@vercel/analytics'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: definePreset(Aura, {
      primitive: {
        pastelrose: {
          50: '#FDF7F8',
          100: '#FDF2F5',
          200: '#FBDFE7',
          300: '#FBD0DC',
          400: '#FBC0D0',
          500: '#FCABC1',
          600: '#FF99B4',
          700: '#F9537F',
          800: '#F10E4B',
          900: '#A40E36',
          950: '#800F2D'
        },
        pastelsky: {
          50: '#FFFFFF',
          100: '#F1FBFE',
          200: '#D8F5FE',
          300: '#B7EEFF',
          400: '#93E3FB',
          500: '#6ED7F7',
          600: '#4DCAEF',
          700: '#2DBBE6',
          800: '#20A3CB',
          900: '#2183A1',
          950: '#24728A'
        },
        pastelyellow: {
          50: '#FFFEFA',
          100: '#FEFCEC',
          200: '#FDF7C9',
          300: '#FFF4A2',
          400: '#FAEC7F',
          500: '#F6E460',
          600: '#EFDB43',
          700: '#E5CF24',
          800: '#C7B31F',
          900: '#9D8E20',
          950: '#8A7E24'
        }
      }
    })
  }
})

app.mount('#app')

inject()
