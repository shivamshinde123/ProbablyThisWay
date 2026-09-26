import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

const webSource = normalizePath(fileURLToPath(new URL(".", import.meta.url)));
const cesiumSource = normalizePath(fileURLToPath(new URL("../../node_modules/cesium/Build/Cesium", import.meta.url)));
const cesiumBuildDirectory = "cesiumStatic";

export default defineConfig(({ command }) => ({
  define: { CESIUM_BASE_URL: JSON.stringify(command === "serve" ? `/@fs/${cesiumSource}` : `/${cesiumBuildDirectory}`) },
  plugins: [
    react(),
    viteStaticCopy({ targets: ["Workers", "ThirdParty", "Assets", "Widgets"].map((directory) => ({ src: `${cesiumSource}/${directory}`, dest: cesiumBuildDirectory })) }),
  ],
  server: { port: 5173, fs: { allow: [webSource, cesiumSource] } },
}));
