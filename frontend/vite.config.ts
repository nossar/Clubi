import { sentryVitePlugin } from "@sentry/vite-plugin";
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

// Source maps exist only to be uploaded, and only when there is a token to upload them with.
// Django serves `dist/` under /static/ (ADR-04), so a .map left behind is the SPA's source
// published to anyone who asks — which is why `filesToDeleteAfterUpload` is not optional and
// why a build without the token emits no maps at all rather than maps nobody deletes.
// Declared here instead of installing @types/node: tsconfig sets `types: ["vite/client"]`, and
// adding "node" to it would put Node's globals in scope for src/ too, where `setTimeout` would
// start returning a NodeJS.Timeout the browser never produces. This file is the only one Vite
// runs in Node.
declare const process: { env: Record<string, string | undefined> };

const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  plugins: [
    react(),
    // Always last, and absent entirely when there is no token: the plugin would otherwise warn
    // on every `npm run build` on a developer machine and in `make check`.
    ...(SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG ?? "clubi-yj",
            project: process.env.SENTRY_PROJECT ?? "clubi-frontend",
            authToken: SENTRY_AUTH_TOKEN,
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          }),
        ]
      : []),
  ],
  build: {
    outDir: "dist",
    manifest: true,
    // "hidden" emits the map but omits the //# sourceMappingURL comment, so the browser never
    // asks for it — only Sentry, which matches by debug id.
    sourcemap: SENTRY_AUTH_TOKEN ? "hidden" : false,
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
      // Deliberately NOT proxied: "/". Since ADR-18 the root is a rendered Django view — the
      // landing page for a visitor, the SPA shell for a member — but it is also this dev
      // server's own root, and proxying it would hand every `npm run dev` session the shell
      // Django renders instead of the app Vite is serving with HMR. The landing page's assets
      // are all under /static, which is covered above, so it needs nothing here: look at it on
      // localhost:8000 in a private window.
    },
  },
});
