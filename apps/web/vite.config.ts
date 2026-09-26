import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

const cesiumSource = "../../node_modules/cesium/Build/Cesium";
const cesiumBaseUrl = "cesiumStatic";

export default defineConfig({
  define: { CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`) },
  plugins: [
    react(),
    viteStaticCopy({ targets: ["Workers", "ThirdParty", "Assets", "Widgets"].map((directory) => ({ src: `${cesiumSource}/${directory}`, dest: cesiumBaseUrl })) }),
  ],
  server: { port: 5173 },
});
