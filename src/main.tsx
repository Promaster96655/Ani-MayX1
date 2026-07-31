import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getApiBaseUrl } from './utils/api.ts';

// Globally intercept and rewrite fetch URLs starting with /api/
const originalFetch = window.fetch;
try {
  Object.defineProperty(window, 'fetch', {
    value: function (input: RequestInfo | URL, init?: RequestInit) {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        const baseUrl = getApiBaseUrl();
        if (baseUrl !== window.location.origin) {
          input = `${baseUrl}${input}`;
        }
      }
      return originalFetch.call(this, input, init);
    },
    writable: true,
    configurable: true,
  });
} catch (e) {
  console.warn('[System] Failed to override global fetch using property definition. Trying fallback.', e);
  try {
    (window as any).fetch = function (input: any, init: any) {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        const baseUrl = getApiBaseUrl();
        if (baseUrl !== window.location.origin) {
          input = `${baseUrl}${input}`;
        }
      }
      return originalFetch.call(this, input, init);
    };
  } catch (err) {
    console.error('[System] Global fetch interception is disabled by the browser.', err);
  }
}

// Silence harmless Firestore internal gRPC stream timeouts from triggering false-positive environment errors
const shouldSuppressLog = (args: any[]) => {
  return args.some(arg => {
    if (!arg) return false;
    const str = typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : String(arg));
    return (
      str.includes('Disconnecting idle stream') ||
      str.includes('Timed out waiting for new targets') ||
      (str.includes('GrpcConnection') && (str.includes('CANCELLED') || str.includes('Code: 1'))) ||
      str.includes('RPC \'Listen\' stream')
    );
  });
};

const originalConsoleError = console.error;
console.error = function (...args: any[]) {
  if (shouldSuppressLog(args)) {
    console.debug('[Firestore Debug] Suppressed benign gRPC idle stream disconnect message.');
    return;
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args: any[]) {
  if (shouldSuppressLog(args)) {
    console.debug('[Firestore Debug] Suppressed benign gRPC idle stream disconnect message.');
    return;
  }
  originalConsoleWarn.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

