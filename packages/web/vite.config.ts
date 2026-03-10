import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4000,
    allowedHosts: ["chronolore.lloyd.codes"],
    proxy: {
      "/api": "http://localhost:4001",
    },
  },
});
