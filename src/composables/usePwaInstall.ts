import { computed, ref, shallowRef } from "vue";

export const PWA_INSTALL_DISMISSED_KEY = "ens-pwa-install-dismissed";

type InstallChoice = { outcome: "accepted" | "dismissed" };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

const installed = ref(false);
const mobile = ref(false);
const ios = ref(false);
const cardDismissed = ref(false);
const guideOpen = ref(false);
const installPrompt = shallowRef<BeforeInstallPromptEvent | null>(null);
let initialized = false;

export const isIOSDevice = (navigator: Pick<Navigator, "userAgent" | "maxTouchPoints">) =>
  /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
  (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export const isMobileDevice = (navigator: Pick<Navigator, "userAgent" | "maxTouchPoints">) =>
  /Android|Mobile/i.test(navigator.userAgent) || isIOSDevice(navigator);

export const isInstalledPwa = (
  navigator: Pick<Navigator, "userAgent"> & { standalone?: boolean },
  standaloneDisplay: boolean
) => standaloneDisplay || navigator.standalone === true;

const initialize = () => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const displayMode = window.matchMedia("(display-mode: standalone)");
  const syncInstalled = () => {
    installed.value = isInstalledPwa(navigator, displayMode.matches);
  };

  mobile.value = isMobileDevice(navigator);
  ios.value = isIOSDevice(navigator);
  syncInstalled();
  displayMode.addEventListener("change", syncInstalled);

  try {
    cardDismissed.value = window.localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) === "1";
  } catch {
    cardDismissed.value = false;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt.value = event as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    installed.value = true;
    installPrompt.value = null;
    guideOpen.value = false;
  });
};

export function usePwaInstall() {
  initialize();

  const available = computed(() => mobile.value && !installed.value);
  const showCard = computed(() => available.value && !cardDismissed.value);

  const install = async () => {
    if (!installPrompt.value) {
      guideOpen.value = true;
      return;
    }

    const prompt = installPrompt.value;
    installPrompt.value = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") installed.value = true;
  };

  const dismissCard = () => {
    cardDismissed.value = true;
    try {
      window.localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, "1");
    } catch {
      // Keep the card dismissed for this session when storage is unavailable.
    }
  };

  return {
    available,
    showCard,
    guideOpen,
    isIOS: computed(() => ios.value),
    hasNativePrompt: computed(() => installPrompt.value !== null),
    install,
    dismissCard,
    closeGuide: () => (guideOpen.value = false)
  };
}
