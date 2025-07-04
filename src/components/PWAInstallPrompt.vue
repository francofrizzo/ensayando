<template>
  <div v-if="showInstallPrompt" class="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
    <div class="alert alert-info shadow-lg">
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 class="font-semibold">Install App</h3>
            <div class="text-xs opacity-80">Get the full experience</div>
          </div>
        </div>
        <div class="flex space-x-2">
          <button @click="installPWA" class="btn btn-sm btn-primary">
            Install
          </button>
          <button @click="dismissPrompt" class="btn btn-sm btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const showInstallPrompt = ref(false);
let deferredPrompt: any = null;

onMounted(() => {
  // Listen for the PWA install prompt
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPrompt.value = true;
  });

  // Hide prompt if already installed
  window.addEventListener('appinstalled', () => {
    showInstallPrompt.value = false;
    deferredPrompt = null;
  });

  // Check if already in standalone mode (already installed)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    showInstallPrompt.value = false;
  }
});

const installPWA = async () => {
  if (!deferredPrompt) return;

  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA: User accepted the install prompt');
    } else {
      console.log('PWA: User dismissed the install prompt');
    }
  } catch (error) {
    console.error('PWA: Error during installation:', error);
  }

  deferredPrompt = null;
  showInstallPrompt.value = false;
};

const dismissPrompt = () => {
  showInstallPrompt.value = false;
  // Store dismissal in localStorage to avoid showing again for a while
  localStorage.setItem('pwa-install-dismissed', Date.now().toString());
};
</script>