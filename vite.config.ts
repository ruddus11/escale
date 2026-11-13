import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import packageJson from "./package.json";

const commitRevision = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
const buildVersion =
  commitRevision === undefined
    ? packageJson.version
    : `${packageJson.version}+${commitRevision}`;

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(buildVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      manifest: {
        name: "Escale",
        short_name: "Escale",
        description: "어느 나라 여행이든 계획과 기록을 한 권에 담는 여행 수첩",
        lang: "ko",
        theme_color: "#F6F3EC",
        background_color: "#111111",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        globIgnores: [
          "**/manifest.webmanifest",
          "**/pwa-192x192.png",
          "**/pwa-512x512.png",
          "**/maskable-icon-512x512.png",
        ],
      },
    }),
  ],
});
