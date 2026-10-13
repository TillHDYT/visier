import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// "single" baut eine flache Ausgabe (alles im selben Ordner) für die
// Einzelseiten-Version, die scripts/build-artifact.mjs zusammensetzt.
export default defineConfig(({ mode }) => ({
  base: "./",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [tailwindcss(), react()],
  server: { host: "0.0.0.0", port: 8080 },
  build:
    mode === "single"
      ? {
          outDir: "dist-single",
          assetsDir: "",
          assetsInlineLimit: 0,
          cssCodeSplit: false,
          modulePreload: false,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : { outDir: "dist" },
}));
