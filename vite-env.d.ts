/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INWORLD_API_KEY_BASE64: string
  readonly VITE_INWORLD_VOICE_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
