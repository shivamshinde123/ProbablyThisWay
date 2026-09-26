import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

const webSource = normalizePath(fileURLToPath(new URL(".", import.meta.url)));
const cesiumSource = normalizePath(
  fileURLToPath(
    new URL("../../node_modules/cesium/Build/Cesium", import.meta.url),
  ),
);
const cesiumBuildDirectory = "cesiumStatic";
const cesiumDirectories = ["Workers", "ThirdParty", "Assets", "Widgets"];

export default defineConfig(({ command }) => ({
  define: {
    CESIUM_BASE_URL: JSON.stringify(
      command === "serve" ? `/@fs/${cesiumSource}` : `/${cesiumBuildDirectory}`,
    ),
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: cesiumDirectories.map((directory) => {
        const sourceDirectory = `${cesiumSource}/${directory}`;
        return {
          src: `${sourceDirectory}/**/*`,
          dest: `${cesiumBuildDirectory}/${directory}`,
          rename: { stripBase: 5 },
        };
      }),
    }),
  ],
  server: { port: 5173, fs: { allow: [webSource, cesiumSource] } },
}));
