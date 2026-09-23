/// <reference types="vite/client" />

/* `vite/client` types `import.meta.env` with an `any` index signature, which would let a typo in
   an env name typecheck and then be `undefined` at runtime. Declaring ours narrows it. */
interface ImportMetaEnv {
  /** Sentry DSN for the browser SDK. Absent in development, so the SDK never starts (ADR-20).
   *  It is baked into the bundle at build time, so it has to exist in Render's *build* env. */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
