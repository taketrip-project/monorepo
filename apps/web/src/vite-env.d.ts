/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL da API (ex.: http://localhost:3333/api/v1). Ver .env.example na raiz do monorepo. */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
