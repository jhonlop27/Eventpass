import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "server", "");
  const proxy = { "/soap": { target: "http://127.0.0.1:" + (env.PORT || 4000), changeOrigin: true } };
  return { plugins: [react()], server: { proxy }, preview: { proxy } };
});
