import { inject } from "@vercel/analytics";
import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "@/App.vue";
import "@/assets/styles.css";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const authStore = useAuthStore();
authStore.initAuth();

app.mount("#app");

inject({
  framework: "vue"
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Show update notification
              if (confirm('A new version is available. Would you like to update?')) {
                window.location.reload();
              }
            }
          });
        }
      });
      
      console.log('PWA: Service Worker registered successfully');
    } catch (error) {
      console.log('PWA: Service Worker registration failed:', error);
    }
  });
}

// PWA Install Prompt
let deferredPrompt: any;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // You can add a custom install button here
  console.log('PWA: Install prompt available');
});

window.addEventListener('appinstalled', () => {
  console.log('PWA: App was installed');
  deferredPrompt = null;
});

// Handle PWA display mode changes
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('PWA: Running in standalone mode');
  // Add any standalone-specific logic here
}

// Prevent zoom on iOS
document.addEventListener('gesturestart', function (e) {
  e.preventDefault();
});

// Handle orientation changes for better PWA experience
window.addEventListener('orientationchange', () => {
  // Small delay to ensure proper rendering after orientation change
  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 100);
});
