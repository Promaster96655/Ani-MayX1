import fs from 'fs';
import path from 'path';

function prepareNetlify() {
  console.log('[Netlify Build Helper] Starting build post-processing...');

  const distPath = path.join(process.cwd(), 'dist');
  const redirectsPath = path.join(distPath, '_redirects');

  // 1. Verify dist folder exists
  if (!fs.existsSync(distPath)) {
    console.error('[Netlify Build Helper] Error: "dist" directory not found. Make sure "vite build" ran successfully.');
    return;
  }

  // 2. Ensure _redirects exists in dist
  if (!fs.existsSync(redirectsPath)) {
    console.log('[Netlify Build Helper] Info: _redirects not found in "dist". Copying from "public/_redirects"...');
    const publicRedirectsPath = path.join(process.cwd(), 'public', '_redirects');
    if (fs.existsSync(publicRedirectsPath)) {
      fs.copyFileSync(publicRedirectsPath, redirectsPath);
    } else {
      console.log('[Netlify Build Helper] Creating a fallback _redirects file...');
      fs.writeFileSync(redirectsPath, '/api/*  https://your-backend-api-url.onrender.com/api/:splat  200\n/*      /index.html                                           200\n');
    }
  }

  // 3. Process VITE_API_BASE_URL environment variable to rewrite the redirect rule
  const apiBaseUrl = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL;
  if (apiBaseUrl) {
    // Sanitize URL (remove trailing slash and /api suffix if provided)
    let sanitizedUrl = apiBaseUrl.trim();
    if (sanitizedUrl.endsWith('/')) {
      sanitizedUrl = sanitizedUrl.slice(0, -1);
    }
    if (sanitizedUrl.endsWith('/api')) {
      sanitizedUrl = sanitizedUrl.slice(0, -4);
    }

    console.log(`[Netlify Build Helper] Found VITE_API_BASE_URL: "${sanitizedUrl}"`);

    try {
      let content = fs.readFileSync(redirectsPath, 'utf8');
      
      // We look for any line starting with /api/* and replace its target URL
      const lines = content.split('\n');
      let updated = false;

      const updatedLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('/api/*')) {
          // Keep the status code (e.g., 200) and replace only the destination URL
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 3) {
            const statusCode = parts[2];
            updated = true;
            return `/api/*  ${sanitizedUrl}/api/:splat  ${statusCode}`;
          }
          updated = true;
          return `/api/*  ${sanitizedUrl}/api/:splat  200`;
        }
        return line;
      });

      if (updated) {
        fs.writeFileSync(redirectsPath, updatedLines.join('\n'), 'utf8');
        console.log(`[Netlify Build Helper] Successfully configured Netlify proxy redirects to target: "${sanitizedUrl}/api/*"`);
      } else {
        // If not found, prepend the new rule
        const rule = `/api/*  ${sanitizedUrl}/api/:splat  200\n`;
        fs.writeFileSync(redirectsPath, rule + content, 'utf8');
        console.log(`[Netlify Build Helper] Prepended redirect rule targeting: "${sanitizedUrl}/api/*"`);
      }
    } catch (err) {
      console.error('[Netlify Build Helper] Failed to rewrite _redirects:', err);
    }
  } else {
    console.log('[Netlify Build Helper] Note: VITE_API_BASE_URL is not set. The placeholder URL in _redirects will be used.');
  }

  console.log('[Netlify Build Helper] Completed successfully!');
}

prepareNetlify();
