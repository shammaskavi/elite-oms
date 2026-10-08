import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import svgr from "@svgr/rollup";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Group the large, stable, eagerly-loaded React-ecosystem libraries into
        // ONE vendor chunk so the browser can cache them across deploys (app-code
        // changes no longer invalidate them). React and its consumers (Radix,
        // React Query, Supabase) must stay in the same chunk so React is always
        // initialized before anything calls React.createContext at load time.
        // Everything else — including the already lazy-loaded chart and PDF
        // chunks — is left to Vite's default splitting, so no lazy-loading
        // boundary is changed.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id) ||
            id.includes("@radix-ui") ||
            id.includes("@tanstack") ||
            id.includes("@supabase")
          ) {
            return "vendor";
          }
        },
      },
    },
  },
}));
