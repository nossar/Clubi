import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Single origin in development (ADR-04): everything Django owns is proxied, so the SPA on
// :5173 sees the same URL map it will see in production and the session cookie is first-party.
const DJANGO = "http://localhost:8000";

// The browser is right that a POST from the SPA is same-origin — it goes to :5173, which is the
// page's own origin. Django is the one that cannot tell, because the proxy hands it a request
// carrying "Origin: http://localhost:5173" while it answers on :8000, and its CSRF origin check
// rejects the mismatch: every unsafe request in development would 403, login and logout included.
// Rewriting both headers to the target restores what is actually true, so the check passes on its
// merits rather than being waived. The token check is untouched, and production has one origin
// for real, so nothing here loosens anything that ships.
const proxyToDjango = {
  target: DJANGO,
  changeOrigin: true,
  headers: { origin: DJANGO },
};

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    manifest: true,
    // Django's shell resolves the bundle through {% static %}, which cannot know a hash Vite
    // invented at build time. Pin the entry names instead; in production WhiteNoise's manifest
    // storage re-hashes them anyway, so cache busting is not lost (frontend/CLAUDE.md).
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": proxyToDjango,
      "/admin": proxyToDjango,
      "/accounts": proxyToDjango,
      "/media": proxyToDjango,
      // /static is load-bearing: the brand fonts and the logotype are served by Django from
      // /static/brand/ (DESIGN.md 2.1). Without it the dev server renders in system fonts and
      // says nothing about why.
      "/static": proxyToDjango,
    },
  },
});
