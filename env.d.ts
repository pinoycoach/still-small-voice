/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INWORLD_API_KEY: string;
  readonly VITE_INWORLD_SECRET_KEY: string;
  readonly VITE_INWORLD_VOICE_ID: string;
  // Add other VITE_ variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
