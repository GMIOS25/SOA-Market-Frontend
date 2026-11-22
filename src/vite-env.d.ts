/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Traefik API Gateway. Empty = same origin (dev proxy / Nginx behind Traefik). */
  readonly VITE_API_BASE_URL?: string
  /** Shows the demo helper toolbar (Mailpit, Consul, Mock panels) — never enable in production. */
  readonly VITE_DEMO_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
