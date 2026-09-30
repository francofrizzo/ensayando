import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import vitePluginVueDevtools from "vite-plugin-vue-devtools";

import { devApi } from "./server/dev-api";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    tailwindcss(),
    mode === "development" ? vitePluginVueDevtools() : null,
    mode === "development" ? devApi(loadEnv(mode, process.cwd(), "")) : null,
    VitePWA({
      injectRegister: false,
      selfDestroying: true,
      manifest: {
        name: "Ensayando",
        short_name: "Ensayando",
        description: "Ensayando",
        theme_color: "#ffffff",
        background_color: "#f8f8f8",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("vanilla-jsoneditor")) {
            return "jsoneditor";
          }
        }
      }
    }
  }
}));
