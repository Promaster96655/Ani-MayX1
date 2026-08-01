/**
 * Production-ready API and WebSocket URL builder
 * Handles environments where the React frontend is deployed separately from the Express backend (e.g., Netlify + Render)
 */

export function getApiBaseUrl(): string {
  // Use user-provided environment variable VITE_API_BASE_URL if available
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim() !== '') {
    // Clean trailing slash
    return envUrl.trim().endsWith('/') ? envUrl.trim().slice(0, -1) : envUrl.trim();
  }
  
  // Default to current host (same-origin/full-stack server)
  return window.location.origin;
}

export function getApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function getWebSocketUrl(path: string = '/api/watch-party'): string {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim() !== '') {
    const cleanUrl = envUrl.trim().endsWith('/') ? envUrl.trim().slice(0, -1) : envUrl.trim();
    // Replace http:// or https:// with ws:// or wss://
    return cleanUrl.replace(/^http/, 'ws') + (path.startsWith('/') ? path : `/${path}`);
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}//${window.location.host}${cleanPath}`;
}
