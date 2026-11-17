export const env = {
  generationWebsocketEnabled: import.meta.env.VITE_GENERATION_WS_ENABLED === 'true',
  appName: import.meta.env.VITE_APP_NAME?.trim() || 'FormaSpace',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || '/api',
}
