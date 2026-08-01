// Production-safe AniSkip API Service with exponential backoff retries and diagnostic tracking

export interface AniSkipTimingInterval {
  startTime: number;
  endTime: number;
}

export interface AniSkipResultItem {
  interval: AniSkipTimingInterval;
  skipType: 'op' | 'ed' | 'mixed-op' | 'mixed-ed' | 'recap';
  skipId: string;
  episodeLength?: number;
}

export interface AniSkipParsedData {
  found: boolean;
  results: AniSkipResultItem[];
  intro?: { exists: boolean; start: number; end: number };
  outro?: { exists: boolean; start: number; end: number };
  skipTypes?: string[];
  reason?: string;
  httpStatus: number;
  durationMs: number;
  finalUrl: string;
  method: string;
  headers?: Record<string, string>;
  rawBody?: string;
  json?: any;
  errorCategory?: string;
  errorMessage?: string;
}

export interface AniSkipDiagnosticLog {
  timestamp: string;
  finalUrl: string;
  method: string;
  httpStatus: number;
  durationMs: number;
  malId: number;
  episodeNumber: number;
  found: boolean;
  errorCategory?: string;
  errorMessage?: string;
  rawBody?: string;
  skipTypes?: string[];
}

export interface SystemDiagnosticsState {
  firebaseStatus: 'Connected' | 'Disconnected' | 'Offline Cache Mode' | 'Checking...';
  aniskipStatus: 'Operational' | 'Degraded' | 'Offline' | 'Checking...';
  internetConnection: boolean;
  environment: string;
  apiEndpoint: string;
  buildMode: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastSuccessfulRequest: AniSkipDiagnosticLog | null;
  lastFailedRequest: AniSkipDiagnosticLog | null;
}

let diagnosticsState: SystemDiagnosticsState = {
  firebaseStatus: 'Checking...',
  aniskipStatus: 'Checking...',
  internetConnection: typeof navigator !== 'undefined' ? navigator.onLine : true,
  environment: typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' ? 'Production' : 'Development',
  apiEndpoint: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ANISKIP_API_BASE) || 'https://api.aniskip.com',
  buildMode: typeof window !== 'undefined' && (window.location.hostname.includes('netlify') || !window.location.port) ? 'Netlify SPA' : 'Full-Stack Express',
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  lastSuccessfulRequest: null,
  lastFailedRequest: null,
};

export function getDiagnosticsState(): SystemDiagnosticsState {
  if (typeof navigator !== 'undefined') {
    diagnosticsState.internetConnection = navigator.onLine;
  }
  return { ...diagnosticsState };
}

export function classifyHttpError(status: number, message?: string): string {
  if (status === 0) {
    if (message?.toLowerCase().includes('cors') || message?.toLowerCase().includes('failed to fetch')) {
      return 'CORS Blocked or Network Error';
    }
    return 'Network Error';
  }
  if (status === 400) return '400 Bad Request (Invalid MAL ID or Ep)';
  if (status === 401) return '401 Unauthorized';
  if (status === 403) return '403 Forbidden';
  if (status === 404) return '404 Not Found (No skip times submitted)';
  if (status === 429) return '429 Rate Limited';
  if (status >= 500) return `${status} Server Error (AniSkip upstream issue)`;
  return `HTTP ${status} Error`;
}

/**
 * Execute AniSkip request with dual-strategy fallback & exponential backoff retries.
 */
export async function fetchAniSkipWithRetry(
  malIdInput: number | string,
  episodeNumberInput: number | string,
  episodeLengthInput: number = 0,
  maxRetries: number = 2
): Promise<AniSkipParsedData> {
  const malId = parseInt(String(malIdInput), 10);
  const epNum = parseInt(String(episodeNumberInput), 10);
  const epLen = Number(episodeLengthInput) || 0;

  if (isNaN(malId) || malId <= 0) {
    const errorLog: AniSkipDiagnosticLog = {
      timestamp: new Date().toISOString(),
      finalUrl: 'N/A',
      method: 'GET',
      httpStatus: 400,
      durationMs: 0,
      malId: 0,
      episodeNumber: epNum || 0,
      found: false,
      errorCategory: 'Invalid Parameter',
      errorMessage: `Invalid MAL ID: "${malIdInput}". Must be a positive integer.`
    };
    diagnosticsState.failedRequests++;
    diagnosticsState.lastFailedRequest = errorLog;
    return {
      found: false,
      results: [],
      httpStatus: 400,
      durationMs: 0,
      finalUrl: 'N/A',
      method: 'GET',
      errorCategory: errorLog.errorCategory,
      errorMessage: errorLog.errorMessage
    };
  }

  const baseApiUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ANISKIP_API_BASE) || 'https://api.aniskip.com';
  const directUrl = `${baseApiUrl}/v2/skip-times/${malId}/${epNum}?types=op&types=ed&types=mixed-op&types=mixed-ed&types=recap&episodeLength=${epLen}`;
  const serverProxyUrl = `/api/aniskip/${malId}/${epNum}?episodeLength=${epLen}`;

  let attempt = 0;
  let lastErrorCategory = '';
  let lastErrorMessage = '';

  const isNetlify = typeof window !== 'undefined' && (
    window.location.hostname.includes('netlify.app') || 
    window.location.hostname.includes('netlify.live') || 
    window.location.hostname.includes('netlify') ||
    (!window.location.port && !window.location.hostname.endsWith('.run.app') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  );

  while (attempt <= maxRetries) {
    attempt++;
    const startTime = Date.now();
    diagnosticsState.totalRequests++;

    let targetUrl = isNetlify ? directUrl : serverProxyUrl;
    let method = 'GET';
    let reqInit: RequestInit = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AniMayX-App/1.0'
      }
    };

    try {
      const res = await fetch(targetUrl, reqInit);
      const durationMs = Date.now() - startTime;
      const status = res.status;

      let rawBody = '';
      let json: any = null;

      rawBody = await res.text();

      // Check for Netlify SPA rewrite HTML response
      if (rawBody.trim().startsWith('<!DOCTYPE') || rawBody.trim().startsWith('<html')) {
        if (targetUrl === serverProxyUrl) {
          console.warn(`[AniSkip Service] Express proxy returned HTML. Retrying directly on AniSkip API...`);
          targetUrl = directUrl;
          const directRes = await fetch(directUrl, reqInit);
          const directDuration = Date.now() - startTime;
          const directStatus = directRes.status;
          rawBody = await directRes.text();
          try {
            json = JSON.parse(rawBody);
          } catch {
            throw new Error(`Direct AniSkip returned non-JSON body: ${rawBody.substring(0, 100)}`);
          }
          if (directRes.ok && json) {
            return parseAndLogAniSkipResponse(json, directStatus, directDuration, directUrl, method, rawBody, malId, epNum);
          } else {
            const errorText = classifyHttpError(directStatus);
            throw new Error(errorText);
          }
        } else {
          throw new Error("Received HTML content instead of JSON API response.");
        }
      }

      try {
        json = JSON.parse(rawBody);
      } catch (parseErr) {
        throw new Error("Invalid JSON body returned from AniSkip.");
      }

      if (res.ok && json) {
        let payload = json;
        if (json.response?.json) {
          payload = json.response.json;
        } else if (json.results) {
          payload = json;
        }
        return parseAndLogAniSkipResponse(payload, status, durationMs, targetUrl, method, rawBody, malId, epNum);
      }

      if (status === 404 || (json && json.statusCode === 404)) {
        const notFoundResult: AniSkipParsedData = {
          found: false,
          results: [],
          httpStatus: 404,
          durationMs,
          finalUrl: targetUrl,
          method,
          rawBody,
          json,
          reason: 'No skip times submitted for this episode yet.'
        };

        const diagnosticLog: AniSkipDiagnosticLog = {
          timestamp: new Date().toISOString(),
          finalUrl: targetUrl,
          method,
          httpStatus: 404,
          durationMs,
          malId,
          episodeNumber: epNum,
          found: false,
          rawBody,
          errorMessage: 'No skip times available for this episode.'
        };
        diagnosticsState.successfulRequests++;
        diagnosticsState.lastSuccessfulRequest = diagnosticLog;
        diagnosticsState.aniskipStatus = 'Operational';
        return notFoundResult;
      }

      lastErrorCategory = classifyHttpError(status);
      lastErrorMessage = json?.message || json?.error || `HTTP ${status} from AniSkip endpoint`;

      if (attempt <= maxRetries && (status >= 500 || status === 429)) {
        const backoffMs = attempt * 1000;
        console.warn(`[AniSkip Service] HTTP ${status}. Retrying in ${backoffMs}ms (Attempt ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      const failLog: AniSkipDiagnosticLog = {
        timestamp: new Date().toISOString(),
        finalUrl: targetUrl,
        method,
        httpStatus: status,
        durationMs,
        malId,
        episodeNumber: epNum,
        found: false,
        errorCategory: lastErrorCategory,
        errorMessage: lastErrorMessage,
        rawBody
      };
      diagnosticsState.failedRequests++;
      diagnosticsState.lastFailedRequest = failLog;
      diagnosticsState.aniskipStatus = 'Degraded';

      return {
        found: false,
        results: [],
        httpStatus: status,
        durationMs,
        finalUrl: targetUrl,
        method,
        rawBody,
        json,
        errorCategory: lastErrorCategory,
        errorMessage: lastErrorMessage
      };

    } catch (fetchErr: any) {
      const durationMs = Date.now() - startTime;
      lastErrorCategory = classifyHttpError(0, fetchErr.message);
      lastErrorMessage = fetchErr.message || 'Failed to fetch from AniSkip endpoint';

      if (targetUrl === serverProxyUrl) {
        console.warn(`[AniSkip Service] Proxy connection failed (${lastErrorMessage}). Re-routing direct to AniSkip...`);
        targetUrl = directUrl;
        attempt--;
        continue;
      }

      if (attempt <= maxRetries) {
        const backoffMs = attempt * 1000;
        console.warn(`[AniSkip Service] Network error. Retrying in ${backoffMs}ms...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      const netFailLog: AniSkipDiagnosticLog = {
        timestamp: new Date().toISOString(),
        finalUrl: directUrl,
        method: 'GET',
        httpStatus: 0,
        durationMs,
        malId,
        episodeNumber: epNum,
        found: false,
        errorCategory: lastErrorCategory,
        errorMessage: lastErrorMessage
      };
      diagnosticsState.failedRequests++;
      diagnosticsState.lastFailedRequest = netFailLog;
      diagnosticsState.aniskipStatus = 'Offline';

      return {
        found: false,
        results: [],
        httpStatus: 0,
        durationMs,
        finalUrl: directUrl,
        method: 'GET',
        errorCategory: lastErrorCategory,
        errorMessage: lastErrorMessage
      };
    }
  }

  return {
    found: false,
    results: [],
    httpStatus: 0,
    durationMs: 0,
    finalUrl: directUrl,
    method: 'GET',
    errorCategory: lastErrorCategory,
    errorMessage: lastErrorMessage
  };
}

function parseAndLogAniSkipResponse(
  json: any,
  status: number,
  durationMs: number,
  finalUrl: string,
  method: string,
  rawBody: string,
  malId: number,
  epNum: number
): AniSkipParsedData {
  const results: AniSkipResultItem[] = Array.isArray(json?.results) ? json.results : [];
  const found = json?.found === true || results.length > 0;

  let intro: { exists: boolean; start: number; end: number } = { exists: false, start: 0, end: 0 };
  let outro: { exists: boolean; start: number; end: number } = { exists: false, start: 0, end: 0 };
  const skipTypes: string[] = [];

  for (const item of results) {
    if (item.skipType) skipTypes.push(item.skipType);
    const typeLower = String(item.skipType || '').toLowerCase().trim();
    const interval = item.interval || (item as any).timing || {};
    const startVal = Number(interval.startTime ?? interval.start_time ?? interval.start ?? 0);
    const endVal = Number(interval.endTime ?? interval.end_time ?? interval.end ?? 0);

    if ((typeLower === 'op' || typeLower === 'mixed-op' || typeLower === 'mixed_op') && endVal > startVal) {
      intro = {
        exists: true,
        start: startVal,
        end: endVal
      };
    }
    if ((typeLower === 'ed' || typeLower === 'mixed-ed' || typeLower === 'mixed_ed') && endVal > startVal) {
      outro = {
        exists: true,
        start: startVal,
        end: endVal
      };
    }
  }

  const resultData: AniSkipParsedData = {
    found,
    results,
    intro,
    outro,
    skipTypes,
    httpStatus: status,
    durationMs,
    finalUrl,
    method,
    rawBody,
    json,
    reason: json?.message || (found ? 'Skip times successfully retrieved' : 'No skip times found')
  };

  const successLog: AniSkipDiagnosticLog = {
    timestamp: new Date().toISOString(),
    finalUrl,
    method,
    httpStatus: status,
    durationMs,
    malId,
    episodeNumber: epNum,
    found,
    rawBody,
    skipTypes
  };

  diagnosticsState.successfulRequests++;
  diagnosticsState.lastSuccessfulRequest = successLog;
  diagnosticsState.aniskipStatus = 'Operational';

  return resultData;
}
