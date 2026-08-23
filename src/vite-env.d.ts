/// <reference types="vite/client" />

/** Variables de `.env` (ver `.env.example`). Sin esto llegan como `any`. */
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_GOOGLE_API_KEY?: string
  readonly VITE_MODO_LOCAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
