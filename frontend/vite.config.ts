import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.API_PROXY_TARGET || "http://127.0.0.1:8080";
  return {
    plugins: [react()],
    server: {
      host: "localhost",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target, changeOrigin: false },
        "/health": { target },
        "/sitemap.xml": { target },
      },
    },
    preview: {
      port: 4173,
      proxy: { "/api": { target, changeOrigin: false }, "/health": { target } },
    },
  };
});
