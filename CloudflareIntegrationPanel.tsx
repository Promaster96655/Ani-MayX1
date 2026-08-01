import React, { useState, useEffect } from 'react';
import { 
  Cloud, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Globe, Search, 
  Lock, Server, RefreshCw, Terminal, ArrowRight, Settings, Key, HelpCircle, Zap, Shield
} from 'lucide-react';

interface CFDiagnosticData {
  isCloudflareProxied: boolean;
  clientIp: string;
  country: string;
  rayId: string;
  datacenter: string;
  protocol: string;
  isSecure: boolean;
  headersReceived: Record<string, string | null>;
}

interface DNSRecord {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

const RECORD_TYPES: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA'
};

export default function CloudflareIntegrationPanel() {
  // Telemetry state
  const [telemetry, setTelemetry] = useState<CFDiagnosticData | null>(null);
  const [isFetchingTelemetry, setIsFetchingTelemetry] = useState(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  // DNS Lookup state
  const [dnsDomain, setDnsDomain] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.hostname;
    }
    return 'watch-ani-mayx.netlify.app';
  });
  const [dnsType, setDnsType] = useState<string>('CNAME');
  const [isQueryingDNS, setIsQueryingDNS] = useState(false);
  const [dnsResults, setDnsResults] = useState<DNSRecord[]>([]);
  const [dnsStatus, setDnsStatus] = useState<string | null>(null);
  const [dnsRawJson, setDnsRawJson] = useState<string | null>(null);

  // SSL/TLS mode selection (interactive guide)
  const [sslMode, setSslMode] = useState<'flexible' | 'full' | 'strict'>('strict');

  // Fetch telemetry on mount
  useEffect(() => {
    fetchTelemetry();
  }, []);

  const fetchTelemetry = async () => {
    setIsFetchingTelemetry(true);
    setTelemetryError(null);
    try {
      const res = await fetch('/api/cloudflare/diagnostic');
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      const data = await res.json();
      setTelemetry(data);
    } catch (err: any) {
      console.error('[Cloudflare Telemetry] Failed:', err);
      setTelemetryError(err?.message || String(err));
    } finally {
      setIsFetchingTelemetry(false);
    }
  };

  const handleDNSQuery = async () => {
    if (!dnsDomain.trim()) return;
    setIsQueryingDNS(true);
    setDnsStatus(null);
    setDnsResults([]);
    setDnsRawJson(null);

    try {
      // Direct query to Cloudflare public DNS JSON endpoint
      const targetDomain = dnsDomain.trim().toLowerCase();
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(targetDomain)}&type=${dnsType}`;
      
      const res = await fetch(url, {
        headers: {
          'accept': 'application/dns-json'
        }
      });

      if (!res.ok) {
        throw new Error(`Cloudflare DNS API returned HTTP ${res.status}`);
      }

      const json = await res.json();
      setDnsRawJson(JSON.stringify(json, null, 2));

      if (json.Status === 0) {
        setDnsStatus('Success');
        if (json.Answer) {
          setDnsResults(json.Answer);
        } else {
          setDnsStatus('Success (No records found for this type)');
        }
      } else {
        setDnsStatus(`Error: DNS Resolution Code ${json.Status}`);
      }
    } catch (err: any) {
      console.error('[DNS Lookup Error] ', err);
      setDnsStatus(`Failed: ${err?.message || String(err)}`);
    } finally {
      setIsQueryingDNS(false);
    }
  };

  const getTypeName = (typeNum: number): string => {
    return RECORD_TYPES[typeNum] || `Type ${typeNum}`;
  };

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'watch-ani-mayx.netlify.app';

  return (
    <div className="space-y-8 text-left animate-fade-in pb-16">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center mb-1">
            <Cloud className="w-6 h-6 text-orange-500 mr-2.5 stroke-[2.5]" />
            <span>CLOUDFLARE INTEGRATION HUB</span>
          </h2>
          <p className="text-xs text-zinc-400 font-medium">
            Configure CNAME proxying, validate live DNS records, audit SSL/TLS parameters, and monitor Cloudflare edge proxy status.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Connection Telemetry Card */}
        <div className="glass-panel p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-6 lg:col-span-1 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 text-orange-400 font-extrabold uppercase text-xs tracking-wider">
              <Shield className="w-4 h-4" />
              <span>Edge Proxy Telemetry</span>
            </div>

            {isFetchingTelemetry ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                <span className="text-xs font-mono text-zinc-500">Querying Cloudflare Edge Headers...</span>
              </div>
            ) : telemetryError ? (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-red-400 font-bold">
                  <XCircle className="w-4 h-4" />
                  <span>Telemetry Unavailable</span>
                </div>
                <p className="text-zinc-400 leading-normal font-mono text-[10px]">
                  Could not retrieve edge proxy headers: {telemetryError}
                </p>
                <p className="text-[10px] text-zinc-500 font-semibold mt-1">
                  Ensure the local back-end server is currently booted and running.
                </p>
              </div>
            ) : telemetry ? (
              <div className="space-y-4">
                {/* Visual Connection Badge */}
                <div className={`p-4 rounded-xl border flex items-center space-x-3 ${
                  telemetry.isCloudflareProxied 
                    ? 'bg-green-500/5 border-green-500/20 text-green-400' 
                    : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                }`}>
                  {telemetry.isCloudflareProxied ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                      <div>
                        <span className="font-bold text-xs block text-green-400">Cloudflare Proxied</span>
                        <span className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                          Traffic is successfully encrypted & routed via Cloudflare Edge Network.
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                      <div>
                        <span className="font-bold text-xs block text-amber-400">Direct Route / Unproxied</span>
                        <span className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                          Accessing directly or via development server. Cloudflare Edge was not detected.
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Telemetry rows */}
                <div className="space-y-3 text-xs font-medium">
                  <div className="flex justify-between border-b border-zinc-900/50 pb-2">
                    <span className="text-zinc-500">Client Real IP</span>
                    <span className="font-mono font-bold text-zinc-300 select-all">{telemetry.clientIp}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/50 pb-2">
                    <span className="text-zinc-500">Client Country</span>
                    <span className="font-mono font-bold text-orange-400">{telemetry.country}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/50 pb-2">
                    <span className="text-zinc-500">Secure Protocol</span>
                    <span className={`font-mono font-bold ${telemetry.isSecure ? 'text-teal-400' : 'text-amber-500'}`}>
                      {telemetry.protocol} {telemetry.isSecure ? '🔒' : '🔓'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900/50 pb-2">
                    <span className="text-zinc-500">CF Datacenter (PoP)</span>
                    <span className="font-mono font-bold text-indigo-400">{telemetry.datacenter}</span>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-zinc-500">Cloudflare Ray ID</span>
                    <span className="font-mono text-[10px] bg-black/40 px-2 py-1.5 rounded border border-zinc-900 text-zinc-400 break-all select-all">
                      {telemetry.rayId}
                    </span>
                  </div>
                </div>

                {/* Header debug logs */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Detected Proxy Headers</span>
                  <div className="bg-black/60 p-3 rounded-lg border border-zinc-900 font-mono text-[9px] text-zinc-400 space-y-1 max-h-24 overflow-y-auto">
                    {Object.entries(telemetry.headersReceived).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-zinc-600">{key}:</span>
                        <span className={val ? 'text-teal-500 font-semibold truncate max-w-[150px]' : 'text-zinc-700'}>
                          {val || 'not set'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Click below to fetch telemetry statistics.</p>
            )}
          </div>

          <button
            onClick={fetchTelemetry}
            disabled={isFetchingTelemetry}
            className="mt-6 text-[11px] font-mono font-bold bg-zinc-900 hover:bg-zinc-850 text-zinc-300 px-4 py-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all flex items-center space-x-2 w-full justify-center cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingTelemetry ? 'animate-spin' : ''}`} />
            <span>RE-TEST CLOUDFLARE EDGE DETECT</span>
          </button>
        </div>

        {/* DNS Lookup Tool */}
        <div className="glass-panel p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-indigo-400 font-extrabold uppercase text-xs tracking-wider">
              <Globe className="w-4 h-4" />
              <span>Cloudflare DNS Record Validator</span>
            </div>
            <span className="font-mono text-[10px] bg-zinc-900 text-zinc-400 px-2 py-0.5 border border-zinc-800 rounded font-bold uppercase">
              DNS-over-HTTPS (DoH)
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Verify if your custom domains are correctly configured, pointing to Netlify servers, and routed through Cloudflare DNS. Enter a host to fetch live authoritative records.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Domain Name / Host</label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 w-4 h-4 text-zinc-600" />
                <input
                  type="text"
                  value={dnsDomain}
                  onChange={(e) => setDnsDomain(e.target.value)}
                  placeholder="e.g. yourdomain.com"
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500/50 rounded-xl pl-9 pr-3 py-2.5 text-zinc-100 text-xs font-semibold outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Record Type</label>
              <select
                value={dnsType}
                onChange={(e) => setDnsType(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500/50 rounded-xl p-2.5 text-zinc-100 text-xs font-semibold outline-none transition-colors cursor-pointer"
              >
                <option value="CNAME">CNAME (Alias)</option>
                <option value="A">A (IPv4 Address)</option>
                <option value="AAAA">AAAA (IPv6 Address)</option>
                <option value="TXT">TXT (Verification)</option>
                <option value="MX">MX (Mail Exchange)</option>
                <option value="NS">NS (Nameserver)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleDNSQuery}
                disabled={isQueryingDNS}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 font-bold text-white px-4 py-3 rounded-xl text-xs active:scale-95 transition-all uppercase font-mono tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {isQueryingDNS ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Querying...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Run Query</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* DNS Lookup Outputs */}
          {dnsStatus && (
            <div className="space-y-4 pt-4 border-t border-zinc-900/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Resolution Status</span>
                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${
                  dnsStatus.includes('Success') 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {dnsStatus}
                </span>
              </div>

              {dnsResults.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-zinc-900 bg-black/30">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-zinc-900/40 border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3">Record Host</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">TTL</th>
                        <th className="p-3">Target / Resolved Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 font-mono text-[11px] text-zinc-300">
                      {dnsResults.map((record, index) => {
                        const isProxiedByCloudflare = dnsType === 'CNAME' && (record.data.includes('netlify') || record.data.includes('cloudfront') || record.data.includes('onrender'));
                        return (
                          <tr key={index} className="hover:bg-zinc-900/30">
                            <td className="p-3 font-semibold break-all text-zinc-400">{record.name}</td>
                            <td className="p-3">
                              <span className="bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-400 font-bold text-[10px]">
                                {getTypeName(record.type)}
                              </span>
                            </td>
                            <td className="p-3 text-zinc-500">{record.TTL}s</td>
                            <td className="p-3 break-all font-semibold select-all text-teal-400">
                              {record.data}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-zinc-900/20 border border-zinc-900/50 rounded-xl p-4 text-center text-xs text-zinc-500 font-mono">
                  No records returned for this hostname query. Verify that the domain was entered correctly and contains appropriate DNS entries.
                </div>
              )}

              {/* Raw JSON Debugger */}
              {dnsRawJson && (
                <div className="space-y-1.5">
                  <details className="cursor-pointer group">
                    <summary className="text-[10px] font-bold text-zinc-500 hover:text-zinc-400 uppercase tracking-wider outline-none select-none flex items-center space-x-1.5">
                      <span>View authoritative JSON Payload</span>
                    </summary>
                    <pre className="text-[9px] text-zinc-400 mt-2 bg-black/80 p-3 rounded-lg border border-zinc-900 overflow-x-auto font-mono max-h-36 leading-relaxed select-all">
                      {dnsRawJson}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SSL/TLS Interactive Diagram Guide */}
      <div className="glass-panel p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-6">
        <div className="flex items-center space-x-2 text-indigo-400 font-extrabold uppercase text-xs tracking-wider">
          <Lock className="w-4 h-4 text-indigo-400" />
          <span>Secure Edge Cryptography (SSL/TLS Modes)</span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed max-w-4xl">
          Cloudflare operates as a Reverse Proxy. Encrypted SSL/TLS has two different connections: from the Client Browser to Cloudflare, and from Cloudflare to your backend Server origin. Select a configuration level to preview the security path.
        </p>

        {/* SSL Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { id: 'flexible', label: 'Flexible SSL', desc: 'No origin SSL required. Traffic is encrypted only up to Cloudflare. Quick setup, but insecure on the backend path.' },
            { id: 'full', label: 'Full SSL', desc: 'Encrypted from client to Edge, and Edge to origin. Accepts self-signed origin SSL certificates. Highly secure.' },
            { id: 'strict', label: 'Full (Strict) SSL', desc: 'Highest safety. Strict validation of verified certificates on both Netlify front-end and Render back-end. Recommended.' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSslMode(mode.id as any)}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                sslMode === mode.id 
                  ? 'bg-orange-500/5 border-orange-500/40 text-orange-400 shadow-lg shadow-orange-500/5' 
                  : 'bg-zinc-900/30 border-zinc-900 text-zinc-400 hover:border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">{mode.label}</span>
                {sslMode === mode.id && <CheckCircle2 className="w-3.5 h-3.5 text-orange-500" />}
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal font-medium">{mode.desc}</p>
            </button>
          ))}
        </div>

        {/* Visual pipeline map */}
        <div className="bg-black/40 border border-zinc-900 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4 text-xs font-mono">
          
          {/* Node 1: Browser */}
          <div className="flex flex-col items-center space-y-2 text-center w-24">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
              <Globe className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="font-black text-white text-[10px] block">CLIENT</span>
              <span className="text-[9px] text-zinc-500">Browser</span>
            </div>
          </div>

          {/* Secure Path 1 */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 w-full">
            <span className="text-[9px] text-green-400 font-bold mb-1.5 flex items-center">
              <Lock className="w-3 h-3 text-green-400 mr-1" />
              HTTPS (SSL/TLS v1.3)
            </span>
            <div className="relative w-full h-1 bg-zinc-900 rounded">
              <div className="absolute inset-y-0 left-0 bg-green-500 rounded animate-pulse w-full"></div>
            </div>
            <span className="text-[8px] text-zinc-500 mt-1 font-semibold">Port 443 Encrypted</span>
          </div>

          {/* Node 2: Cloudflare Edge */}
          <div className="flex flex-col items-center space-y-2 text-center w-28">
            <div className="w-12 h-12 bg-orange-950/20 border border-orange-500/30 rounded-full flex items-center justify-center text-orange-500 shadow-lg shadow-orange-500/10">
              <Cloud className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <span className="font-black text-orange-400 text-[10px] block">CLOUDFLARE</span>
              <span className="text-[9px] text-zinc-500">Global Edge Proxy</span>
            </div>
          </div>

          {/* Secure Path 2 (Dynamic based on select) */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 w-full">
            {sslMode === 'flexible' ? (
              <>
                <span className="text-[9px] text-red-400 font-bold mb-1.5 flex items-center">
                  <AlertTriangle className="w-3 h-3 text-red-400 mr-1" />
                  HTTP (UNENCRYPTED)
                </span>
                <div className="relative w-full h-1 bg-zinc-900 rounded">
                  <div className="absolute inset-y-0 left-0 bg-red-500 rounded w-full"></div>
                </div>
                <span className="text-[8px] text-zinc-500 mt-1 font-semibold">Port 80 Cleartext</span>
              </>
            ) : (
              <>
                <span className={`text-[9px] font-bold mb-1.5 flex items-center ${sslMode === 'strict' ? 'text-green-400' : 'text-teal-400'}`}>
                  <Lock className="w-3 h-3 mr-1" />
                  {sslMode === 'strict' ? 'HTTPS (Full Strict)' : 'HTTPS (Full SSL)'}
                </span>
                <div className="relative w-full h-1 bg-zinc-900 rounded">
                  <div className={`absolute inset-y-0 left-0 rounded w-full ${sslMode === 'strict' ? 'bg-green-500' : 'bg-teal-500'}`}></div>
                </div>
                <span className="text-[8px] text-zinc-500 mt-1 font-semibold">Port 443 Authoritative SSL</span>
              </>
            )}
          </div>

          {/* Node 3: Host Origin */}
          <div className="flex flex-col items-center space-y-2 text-center w-28">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
              <Server className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="font-black text-white text-[10px] block">ORIGIN SERVER</span>
              <span className="text-[9px] text-zinc-500">Netlify / Render</span>
            </div>
          </div>

        </div>
      </div>

      {/* Edge Routing & DNS Tutorial */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* step-by-step CNAME Tutorial */}
        <div className="glass-panel p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-6">
          <div className="flex items-center space-x-2 text-orange-400 font-extrabold uppercase text-xs tracking-wider">
            <Settings className="w-4 h-4" />
            <span>Interactive CNAME Setup Checklist</span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Follow these simple steps in your Cloudflare dashboard to hook up your custom domain to AnimayX:
          </p>

          <div className="space-y-4 text-xs">
            <div className="flex items-start space-x-3.5">
              <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-[10px] text-orange-400 shrink-0 font-mono mt-0.5">
                1
              </div>
              <div className="space-y-1">
                <span className="font-bold text-zinc-200">Add Site in Cloudflare</span>
                <p className="text-zinc-400 leading-normal font-medium text-[11px]">
                  Log in to Cloudflare, click <strong className="text-zinc-300">"Add site"</strong>, and insert your custom domain (e.g. <code>animayx.com</code>). Select the Free plan tier.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5">
              <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-[10px] text-orange-400 shrink-0 font-mono mt-0.5">
                2
              </div>
              <div className="space-y-1.5 w-full">
                <span className="font-bold text-zinc-200">Configure DNS CNAME Records</span>
                <p className="text-zinc-400 leading-normal font-medium text-[11px] mb-2">
                  Navigate to the <strong className="text-zinc-300">DNS</strong> tab, add a new record, and proxy it.
                </p>
                <div className="bg-black/60 border border-zinc-900 rounded-xl p-3 font-mono text-[10px] space-y-1 text-zinc-300 select-all">
                  <div>Type: <span className="text-orange-400 font-bold">CNAME</span></div>
                  <div>Name: <span className="text-teal-400 font-bold">@</span> (or <span className="text-teal-400 font-bold">watch</span>)</div>
                  <div>Target: <span className="text-indigo-400 font-bold">watch-ani-mayx.netlify.app</span></div>
                  <div>Proxy status: <span className="text-green-400 font-bold">Proxied (Orange Cloud)</span></div>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3.5">
              <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-[10px] text-orange-400 shrink-0 font-mono mt-0.5">
                3
              </div>
              <div className="space-y-1">
                <span className="font-bold text-zinc-200">Change Authoritative Nameservers</span>
                <p className="text-zinc-400 leading-normal font-medium text-[11px]">
                  Go to your domain registrar (GoDaddy, Namecheap, etc.) and replace your current nameservers with the custom Cloudflare nameservers provided in your console (e.g., <code>ns.cloudflare.com</code>).
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5">
              <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-[10px] text-orange-400 shrink-0 font-mono mt-0.5">
                4
              </div>
              <div className="space-y-1">
                <span className="font-bold text-zinc-200">Configure SSL/TLS Mode</span>
                <p className="text-zinc-400 leading-normal font-medium text-[11px]">
                  Under <strong className="text-zinc-300">SSL/TLS Overview</strong>, set the encryption mode to <strong className="text-zinc-300">Full</strong> or <strong className="text-zinc-300">Full (Strict)</strong>. Turn on <strong className="text-zinc-300">"Always Use HTTPS"</strong> to auto-redirect HTTP users.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Optimizer Recommendations */}
        <div className="glass-panel p-6 rounded-2xl border border-zinc-900 bg-zinc-950/40 space-y-6">
          <div className="flex items-center space-x-2 text-indigo-400 font-extrabold uppercase text-xs tracking-wider">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span>Edge WAF & Performance Optimizer</span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Optimize your Cloudflare routing configuration specifically for a video-streaming and high-interactivity platform:
          </p>

          <div className="space-y-4 text-xs font-semibold">
            {/* WAF Rate Limits */}
            <div className="flex space-x-3.5">
              <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-zinc-200 text-xs font-bold">WAF Rate Limiting</h4>
                <p className="text-zinc-400 text-[11px] leading-relaxed font-medium">
                  Add a Custom WAF rate-limit rule targeting <code>/api/*</code> endpoints. Set limit to 10 requests per second per IP to block scraper bots while allowing healthy human browser usage.
                </p>
              </div>
            </div>

            {/* Brotli Compression */}
            <div className="flex space-x-3.5">
              <Zap className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-zinc-200 text-xs font-bold">Brotli & Auto Minify</h4>
                <p className="text-zinc-400 text-[11px] leading-relaxed font-medium">
                  Under <strong className="text-zinc-300">Speed &rarr; Optimization</strong>, enable Brotli compression and toggle JavaScript/CSS auto-minification. This cuts client load bundle sizes by up to 30%.
                </p>
              </div>
            </div>

            {/* Cache Control & Bypass */}
            <div className="flex space-x-3.5">
              <Terminal className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-zinc-200 text-xs font-bold">Cache-Control Rules</h4>
                <p className="text-zinc-400 text-[11px] leading-relaxed font-medium">
                  Ensure <code>/api/*</code> and database syncing paths are excluded from standard Cloudflare caching. Set a Page Rule for <code>*yourdomain.com/api/*</code> with <strong className="text-zinc-300">Cache Level: Bypass</strong> to maintain real-time Watch Parties!
                </p>
              </div>
            </div>

            {/* IP Geolocation Header */}
            <div className="flex space-x-3.5">
              <Globe className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-zinc-200 text-xs font-bold">IP Geolocation Headers</h4>
                <p className="text-zinc-400 text-[11px] leading-relaxed font-medium">
                  Turn on <strong className="text-zinc-300">"IP Geolocation"</strong> in the Cloudflare Network settings. This allows our backend to auto-detect client countries for localized telemetry and server optimization.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
