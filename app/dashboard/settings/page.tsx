'use client';

import { useState, useEffect, useRef } from 'react';

// ---- Wayback Machine ----
async function checkWayback(url: string) {
  const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Wayback ${res.status}`);
  return res.json();
}

// ---- InternetDB (free Shodan — no key required) ----
async function checkInternetDB(ip: string) {
  const res = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`);
  if (!res.ok) {
    if (res.status === 404) return { detail: 'No information available for this IP.' };
    throw new Error(`InternetDB ${res.status}`);
  }
  return res.json();
}

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-2xl">{emoji}</span>
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function ToolsPage() {
  // ---- Dark mode ----
  const [isDark, setIsDark] = useState(false);

  // ---- NumVerify ----
  const [nvPhone, setNvPhone] = useState('');
  const [nvResult, setNvResult] = useState<any>(null);
  const [nvLoading, setNvLoading] = useState(false);
  const [nvError, setNvError] = useState<string | null>(null);

  const handleNumVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nvPhone.trim()) return;
    setNvLoading(true); setNvError(null); setNvResult(null);
    try {
      const res = await fetch(`/api/numverify?number=${encodeURIComponent(nvPhone.trim())}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setNvResult(json);
    } catch (err: any) {
      setNvError(err.message);
    } finally {
      setNvLoading(false);
    }
  };

  // ---- PGP Key Lookup ----
  const [pgpEmail, setPgpEmail] = useState('');
  const [pgpResult, setPgpResult] = useState<any>(null);
  const [pgpLoading, setPgpLoading] = useState(false);
  const [pgpError, setPgpError] = useState<string | null>(null);

  const handlePgp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pgpEmail.trim()) return;
    setPgpLoading(true); setPgpError(null); setPgpResult(null);
    try {
      const res = await fetch(`https://keys.openpgp.org/vks/v1/by-email/${encodeURIComponent(pgpEmail.trim())}`);
      if (res.status === 404) { setPgpResult({ found: false }); return; }
      if (!res.ok) throw new Error(`PGP server returned ${res.status}`);
      // Response is armored PGP key text
      const text = await res.text();
      setPgpResult({ found: true, armored: text });
    } catch (err: any) {
      setPgpError(err.message);
    } finally {
      setPgpLoading(false);
    }
  };

  // ---- HudsonRock (compromised credentials) ----
  const [hrInput, setHrInput] = useState('');
  const [hrType, setHrType] = useState<'email' | 'domain'>('email');
  const [hrResult, setHrResult] = useState<any>(null);
  const [hrLoading, setHrLoading] = useState(false);
  const [hrError, setHrError] = useState<string | null>(null);

  const handleHudsonRock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hrInput.trim()) return;
    setHrLoading(true); setHrError(null); setHrResult(null);
    try {
      const endpoint = hrType === 'email'
        ? `https://cavalier.hudsonrock.com/api/json/v2/osint-tools/is-email-affected?email=${encodeURIComponent(hrInput.trim())}`
        : `https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-domain?domain=${encodeURIComponent(hrInput.trim())}`;
      const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HudsonRock ${res.status}`);
      setHrResult(await res.json());
    } catch (err: any) {
      setHrError(err.message);
    } finally {
      setHrLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = saved === 'dark' || (!saved && systemDark);
    setIsDark(initialDark);
    document.documentElement.classList.toggle('dark', initialDark);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  // ---- Wayback Machine ----
  const [wbUrl, setWbUrl] = useState('');
  const [wbResult, setWbResult] = useState<any>(null);
  const [wbLoading, setWbLoading] = useState(false);
  const [wbError, setWbError] = useState<string | null>(null);

  const handleWayback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wbUrl.trim()) return;
    setWbLoading(true); setWbError(null); setWbResult(null);
    try {
      setWbResult(await checkWayback(wbUrl.trim()));
    } catch (err: any) {
      setWbError(err.message);
    } finally {
      setWbLoading(false);
    }
  };

  const snapshot = wbResult?.archived_snapshots?.closest;

  // ---- InternetDB / IP Intel ----
  const [idbIp, setIdbIp] = useState('');
  const [idbResult, setIdbResult] = useState<any>(null);
  const [idbLoading, setIdbLoading] = useState(false);
  const [idbError, setIdbError] = useState<string | null>(null);

  const handleInternetDB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idbIp.trim()) return;
    setIdbLoading(true); setIdbError(null); setIdbResult(null);
    try {
      setIdbResult(await checkInternetDB(idbIp.trim()));
    } catch (err: any) {
      setIdbError(err.message);
    } finally {
      setIdbLoading(false);
    }
  };

  return (
    <div className="p-10 bg-[#fff0f8] dark:bg-zinc-950 min-h-full">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent mb-12">
        🛠️ Tools
      </h1>

      <div className="max-w-2xl space-y-8">

        {/* ── Appearance ─────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader emoji="🎨" title="Appearance" subtitle="Auto-detects system preference — override here if needed" />

          <div
            onClick={toggleTheme}
            className="flex justify-between items-center p-6 rounded-2xl border border-pink-200 dark:border-slate-700 cursor-pointer hover:bg-pink-50 dark:hover:bg-slate-700 transition-all"
          >
            <div>
              <div className="font-medium text-slate-800 dark:text-slate-100">
                {isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {isDark ? 'Click to switch to light mode' : 'Click to switch to dark mode'}
              </div>
            </div>
            <div className={`w-14 h-8 rounded-full relative flex items-center transition-all ${isDark ? 'bg-pink-500' : 'bg-slate-300'}`}>
              <div className={`absolute w-6 h-6 bg-white rounded-full shadow-md transition-all ${isDark ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </div>
        </div>

        {/* ── Wayback Machine ────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="🕰️"
            title="Wayback Machine"
            subtitle="Check if a URL has been archived by the Internet Archive — no API key required"
          />

          <form onSubmit={handleWayback} className="flex gap-3 mb-4">
            <input
              type="text"
              value={wbUrl}
              onChange={e => setWbUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-purple-400 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={wbLoading}
              className="bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition"
            >
              {wbLoading ? 'Checking…' : 'Check Archive'}
            </button>
          </form>

          {wbError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm">
              {wbError}
            </div>
          )}

          {wbResult && (
            <div className="mt-2 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm space-y-2">
              {snapshot?.available ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="font-semibold text-green-600 dark:text-green-400">Archived snapshot found</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Captured: </span>
                    {snapshot.timestamp?.replace(
                      /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
                      '$1-$2-$3 at $4:$5 UTC'
                    )}
                  </div>
                  <div className="text-slate-500 dark:text-slate-500">HTTP Status: {snapshot.status}</div>
                  <a
                    href={snapshot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-purple-600 dark:text-purple-400 hover:underline font-medium"
                  >
                    View archived snapshot →
                  </a>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-slate-500">No archived snapshot available for this URL.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── IP Intel (InternetDB / Shodan free) ────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="🔌"
            title="IP Intel"
            subtitle="Open ports, CVEs, hostnames, and tags for any IP — powered by Shodan's free InternetDB, no key required"
          />

          <form onSubmit={handleInternetDB} className="flex gap-3 mb-4">
            <input
              type="text"
              value={idbIp}
              onChange={e => setIdbIp(e.target.value)}
              placeholder="8.8.8.8"
              className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none focus:border-cyan-400 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={idbLoading}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition"
            >
              {idbLoading ? 'Looking up…' : 'Lookup IP'}
            </button>
          </form>

          {idbError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm">
              {idbError}
            </div>
          )}

          {idbResult && (
            <div className="mt-2 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm space-y-4">
              {idbResult.detail ? (
                <p className="text-slate-500 italic">{idbResult.detail}</p>
              ) : (
                <>
                  {idbResult.hostnames?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Hostnames</div>
                      <div className="space-y-1">
                        {idbResult.hostnames.map((h: string) => (
                          <div key={h} className="font-mono text-slate-700 dark:text-slate-300 text-xs">{h}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {idbResult.ports?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Open Ports</div>
                      <div className="flex flex-wrap gap-1.5">
                        {idbResult.ports.map((p: number) => (
                          <span key={p} className="bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 font-mono text-xs px-2.5 py-1 rounded-lg">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {idbResult.cpes?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Software (CPE)</div>
                      <div className="space-y-1">
                        {idbResult.cpes.slice(0, 8).map((c: string) => (
                          <div key={c} className="font-mono text-slate-600 dark:text-slate-400 text-xs truncate">{c}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {idbResult.vulns?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">
                        CVEs ({idbResult.vulns.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {idbResult.vulns.map((v: string) => (
                          <a
                            key={v}
                            href={`https://nvd.nist.gov/vuln/detail/${v}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-mono text-xs px-2.5 py-1 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/70 transition"
                          >
                            {v}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {idbResult.tags?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {idbResult.tags.map((t: string) => (
                          <span key={t} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-1 rounded-lg">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Phone Lookup (NumVerify) ─────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="📞"
            title="Phone Number Lookup"
            subtitle="Validate any phone number and identify carrier, line type, and location — powered by NumVerify"
          />

          <form onSubmit={handleNumVerify} className="flex gap-3 mb-4">
            <input
              type="text"
              value={nvPhone}
              onChange={e => setNvPhone(e.target.value)}
              placeholder="+14158586273"
              className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none focus:border-emerald-400 placeholder:text-slate-400"
            />
            <button type="submit" disabled={nvLoading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
              {nvLoading ? 'Looking up…' : 'Lookup'}
            </button>
          </form>
          {nvError && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm">{nvError}</div>}
          {nvResult && (
            <div className="mt-2 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm space-y-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${nvResult.valid ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className={`font-semibold ${nvResult.valid ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {nvResult.valid ? 'Valid number' : 'Invalid / unrecognised number'}
                </span>
              </div>
              {nvResult.valid && (
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-slate-600 dark:text-slate-300">
                  {nvResult.intlFormat  && <><span className="text-slate-400">International</span><span className="font-mono">{nvResult.intlFormat}</span></>}
                  {nvResult.localFormat && <><span className="text-slate-400">Local</span><span className="font-mono">{nvResult.localFormat}</span></>}
                  {nvResult.countryName && <><span className="text-slate-400">Country</span><span>{nvResult.countryName} ({nvResult.countryCode})</span></>}
                  {nvResult.location    && <><span className="text-slate-400">Location</span><span>{nvResult.location}</span></>}
                  {nvResult.carrier     && <><span className="text-slate-400">Carrier</span><span>{nvResult.carrier}</span></>}
                  {nvResult.lineType    && <><span className="text-slate-400">Line type</span><span className="capitalize">{nvResult.lineType}</span></>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── PGP Key Lookup ───────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="🔑"
            title="PGP Key Lookup"
            subtitle="Check if an email has a public PGP key registered on keys.openpgp.org"
          />
          <form onSubmit={handlePgp} className="flex gap-3 mb-4">
            <input type="email" value={pgpEmail} onChange={e => setPgpEmail(e.target.value)}
              placeholder="target@example.com"
              className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-indigo-400 placeholder:text-slate-400" />
            <button type="submit" disabled={pgpLoading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
              {pgpLoading ? 'Checking…' : 'Check Key'}
            </button>
          </form>
          {pgpError && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm">{pgpError}</div>}
          {pgpResult && (
            <div className="mt-2 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm">
              {pgpResult.found ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="font-semibold text-green-600 dark:text-green-400">Public PGP key found</span>
                  </div>
                  <pre className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl p-3 overflow-x-auto max-h-48 select-all">{pgpResult.armored}</pre>
                  <a href={`https://keys.openpgp.org/search?q=${encodeURIComponent(pgpEmail)}`} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-block text-indigo-500 hover:underline text-sm">View on keyserver →</a>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-slate-500">No PGP key found for this email.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── HudsonRock ───────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="💀"
            title="Compromised Credentials"
            subtitle="Check if an email or domain appears in infostealer malware logs — HudsonRock Cavalier (free)"
          />
          <form onSubmit={handleHudsonRock} className="space-y-3 mb-4">
            <div className="flex gap-2">
              {(['email', 'domain'] as const).map(t => (
                <button key={t} type="button" onClick={() => setHrType(t)}
                  className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition ${hrType === t ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                  {t === 'email' ? '📧 Email' : '🌐 Domain'}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <input type="text" value={hrInput} onChange={e => setHrInput(e.target.value)}
                placeholder={hrType === 'email' ? 'target@company.com' : 'company.com'}
                className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none focus:border-rose-400 placeholder:text-slate-400" />
              <button type="submit" disabled={hrLoading}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
                {hrLoading ? 'Checking…' : 'Check'}
              </button>
            </div>
          </form>
          {hrError && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm">{hrError}</div>}
          {hrResult && (
            <div className="mt-2 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm">
              {hrType === 'email' ? (
                hrResult.stealers?.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="font-semibold text-red-500">Compromised credentials detected</span>
                    </div>
                    <div className="space-y-2">
                      {hrResult.stealers.slice(0, 5).map((s: any, i: number) => (
                        <div key={i} className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-xs">
                          <div className="font-bold text-red-600 dark:text-red-400">{s.malware_path || s.stealer_type || 'Unknown stealer'}</div>
                          {s.date_compromised && <div className="text-slate-500 mt-0.5">Compromised: {s.date_compromised}</div>}
                          {s.computer_name && <div className="text-slate-500">Machine: {s.computer_name}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /><span className="text-green-600 dark:text-green-400 font-semibold">Not found in known infostealer logs</span></div>
                )
              ) : (
                hrResult.employees?.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="font-semibold text-red-500">{hrResult.employees.length} affected employee(s) found</span>
                    </div>
                    <div className="space-y-2">
                      {hrResult.employees.slice(0, 10).map((emp: any, i: number) => (
                        <div key={i} className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-xs">
                          <div className="font-bold text-red-600 dark:text-red-400">{emp.username || emp.email}</div>
                          {emp.date_compromised && <div className="text-slate-500 mt-0.5">Compromised: {emp.date_compromised}</div>}
                          {emp.stealer_type && <div className="text-slate-500">Stealer: {emp.stealer_type}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /><span className="text-green-600 dark:text-green-400 font-semibold">No affected employees found for this domain</span></div>
                )
              )}
            </div>
          )}
        </div>

        {/* ── RDAP / WHOIS ─────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="🌍"
            title="RDAP / WHOIS"
            subtitle="Domain & IP registration data via RDAP — free, no key, replaces WHOIS"
          />
          <RdapTool />
        </div>

        {/* ── URLScan ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="🔍"
            title="URLScan.io"
            subtitle="Search existing URL scans — free. Submit new scans requires a free URLSCAN_KEY."
          />
          <URLScanTool />
        </div>

        {/* ── URLhaus ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="☣️"
            title="URLhaus Malware Check"
            subtitle="Check URLs and hosts against Abuse.ch's malware URL database — free, no key"
          />
          <URLhausTool />
        </div>

        {/* ── VirusTotal ───────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="🦠"
            title="VirusTotal"
            subtitle="Scan URLs, IPs, domains, and file hashes against 90+ antivirus engines — free key at virustotal.com (set VT_KEY in .env)"
          />
          <VTTool />
        </div>

        {/* ── AbuseIPDB ────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="🚨"
            title="AbuseIPDB"
            subtitle="Check IP reputation and abuse reports — free 1000 req/day key at abuseipdb.com (set ABUSEIPDB_KEY in .env)"
          />
          <AbuseIPDBTool />
        </div>

        {/* ── GreyNoise ────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="🌫️"
            title="GreyNoise"
            subtitle="Identify internet background noise scanners vs. targeted threats — free key at greynoise.io (set GREYNOISE_KEY in .env)"
          />
          <GreyNoiseTool />
        </div>

        {/* ── OTX AlienVault ───────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
          <SectionHeader
            emoji="👽"
            title="OTX AlienVault"
            subtitle="Threat intel pulses for IPs, domains, URLs — free key at otx.alienvault.com (set OTX_KEY in .env)"
          />
          <OTXTool />
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ResultBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm space-y-3">
      {children}
    </div>
  );
}

function KVRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-3">
      <span className="text-slate-400 w-32 shrink-0">{label}</span>
      <span className="font-mono text-slate-700 dark:text-slate-200 break-all">{String(value)}</span>
    </div>
  );
}

function TagRow({ label, tags }: { label: string; tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-widest mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span key={t} className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md text-xs text-slate-600 dark:text-slate-300">{t}</span>
        ))}
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="mt-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm">
      {msg}
    </div>
  );
}

// ── RDAP Tool ─────────────────────────────────────────────────────────────────
function RdapTool() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/rdap?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="example.com or 8.8.8.8"
          className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none focus:border-teal-400 placeholder:text-slate-400" />
        <button type="submit" disabled={loading}
          className="bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
          {loading ? 'Looking up…' : 'Lookup'}
        </button>
      </form>
      {error && <ErrorBox msg={error} />}
      {result && (
        <ResultBox>
          <div className="font-semibold text-slate-700 dark:text-slate-200">
            {result.type === 'domain' ? `🌐 ${result.domain}` : `🔌 ${result.startAddress} – ${result.endAddress}`}
          </div>
          <KVRow label="Status" value={(result.status ?? []).join(', ')} />
          <KVRow label="Registered" value={result.registered} />
          <KVRow label="Expires" value={result.expiration} />
          <KVRow label="Last Changed" value={result.lastChanged} />
          <KVRow label="Registrar" value={result.registrarName} />
          <KVRow label="Registrant" value={result.registrant?.name || result.registrant?.org} />
          <KVRow label="Country" value={result.country || result.registrant?.country} />
          <KVRow label="Org" value={result.orgName} />
          <KVRow label="IP Range" value={result.startAddress && `${result.startAddress} – ${result.endAddress}`} />
          <KVRow label="IP Version" value={result.ipVersion} />
          {result.nameservers?.length > 0 && (
            <TagRow label="Nameservers" tags={result.nameservers} />
          )}
          <KVRow label="DNSSEC" value={result.secureDns ? 'Enabled' : 'Not signed'} />
        </ResultBox>
      )}
    </>
  );
}

// ── URLScan Tool ───────────────────────────────────────────────────────────────
function URLScanTool() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setError(null); setResults([]); setSelected(null);
    try {
      const res = await fetch(`/api/urlscan?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResults(json.results ?? []);
      setTotal(json.total ?? 0);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const loadDetail = async (uuid: string) => {
    setDetailLoading(true); setSelected(null);
    try {
      const res = await fetch(`/api/urlscan?action=result&uuid=${uuid}`);
      const json = await res.json();
      setSelected(json);
    } catch {}
    finally { setDetailLoading(false); }
  };

  return (
    <>
      <form onSubmit={search} className="flex gap-3 mb-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="domain, IP, or keyword"
          className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none focus:border-violet-400 placeholder:text-slate-400" />
        <button type="submit" disabled={loading}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <ErrorBox msg={error} />}
      {results.length > 0 && (
        <div className="mt-2 space-y-2">
          <div className="text-xs text-slate-400 mb-2">{total} total scans found</div>
          {results.slice(0, 8).map(r => (
            <div key={r.uuid}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${r.malicious ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'} hover:border-violet-400`}
              onClick={() => loadDetail(r.uuid)}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-slate-700 dark:text-slate-200 truncate">{r.url}</div>
                  <div className="text-xs text-slate-400 mt-1">{r.domain} · {r.country} · {r.date?.slice(0, 10)}</div>
                </div>
                {r.malicious && <span className="shrink-0 px-2 py-0.5 bg-red-500 text-white text-xs rounded-lg">MALICIOUS</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {detailLoading && <div className="mt-3 text-xs text-slate-400 animate-pulse">Loading scan details…</div>}
      {selected && (
        <ResultBox>
          <div className="font-semibold">{selected.url}</div>
          {selected.screenshot && (
            <img src={selected.screenshot} alt="Screenshot" className="rounded-xl w-full max-h-40 object-cover border border-slate-200" onError={e => (e.target as HTMLImageElement).style.display='none'} />
          )}
          <KVRow label="Domain" value={selected.domain} />
          <KVRow label="IP" value={selected.ip} />
          <KVRow label="Country" value={selected.country} />
          <KVRow label="Server" value={selected.server} />
          <KVRow label="Title" value={selected.title} />
          <KVRow label="Score" value={selected.score} />
          <KVRow label="Malicious" value={selected.malicious ? 'YES' : 'No'} />
          <TagRow label="Tags" tags={selected.tags} />
          <TagRow label="Technologies" tags={selected.technologies} />
          <a href={`https://urlscan.io/result/${selected.uuid}/`} target="_blank" rel="noopener noreferrer"
            className="text-violet-500 hover:underline text-xs">Full report on URLScan →</a>
        </ResultBox>
      )}
    </>
  );
}

// ── URLhaus Tool ───────────────────────────────────────────────────────────────
function URLhausTool() {
  const [q, setQ] = useState('');
  const [qType, setQType] = useState<'url' | 'host'>('url');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/urlhaus?q=${encodeURIComponent(q.trim())}&type=${qType}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="flex gap-2 mb-3">
        {(['url', 'host'] as const).map(t => (
          <button key={t} type="button" onClick={() => setQType(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${qType === t ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
            {t === 'url' ? '🔗 URL' : '🖥 Host/IP'}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-2">
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder={qType === 'url' ? 'https://malicious.example.com/payload' : 'example.com or 1.2.3.4'}
          className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none focus:border-amber-400 placeholder:text-slate-400" />
        <button type="submit" disabled={loading}
          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
          {loading ? 'Checking…' : 'Check'}
        </button>
      </form>
      {error && <ErrorBox msg={error} />}
      {result && (
        <ResultBox>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${result.found ? 'bg-red-500' : 'bg-green-500'}`} />
            <span className={`font-semibold ${result.found ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {result.found ? 'Found in URLhaus malware database' : 'Not found in URLhaus'}
            </span>
          </div>
          <KVRow label="Status" value={result.urlStatus} />
          <KVRow label="Threat" value={result.threat} />
          <KVRow label="Date Added" value={result.dateAdded} />
          <KVRow label="Reporter" value={result.reporter} />
          <TagRow label="Tags" tags={result.tags} />
          {result.urls?.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Associated URLs</div>
              {result.urls.slice(0, 5).map((u: any, i: number) => (
                <div key={i} className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate py-0.5">{u.url} <span className="text-red-400">{u.threat}</span></div>
              ))}
            </div>
          )}
        </ResultBox>
      )}
    </>
  );
}

// ── VirusTotal Tool ────────────────────────────────────────────────────────────
function VTTool() {
  const [q, setQ] = useState('');
  const [qType, setQType] = useState<'url' | 'ip' | 'domain' | 'file'>('domain');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/virustotal?q=${encodeURIComponent(q.trim())}&type=${qType}`);
      const json = await res.json();
      if (json.error && !json.notFound) throw new Error(json.error);
      setResult(json);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const totalEngines = result ? (result.malicious + result.suspicious + result.undetected + result.harmless + result.timeout) : 0;

  return (
    <>
      <div className="flex gap-2 mb-3 flex-wrap">
        {(['domain', 'ip', 'url', 'file'] as const).map(t => (
          <button key={t} type="button" onClick={() => setQType(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${qType === t ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
            {t === 'domain' ? '🌐 Domain' : t === 'ip' ? '🔌 IP' : t === 'url' ? '🔗 URL' : '📄 File Hash'}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-2">
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder={qType === 'file' ? 'SHA256 / MD5 hash' : qType === 'url' ? 'https://...' : qType === 'ip' ? '1.2.3.4' : 'example.com'}
          className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none focus:border-green-400 placeholder:text-slate-400" />
        <button type="submit" disabled={loading}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
          {loading ? 'Scanning…' : 'Scan'}
        </button>
      </form>
      {error && <ErrorBox msg={error} />}
      {result?.notFound && <div className="mt-3 text-slate-400 text-sm italic">Not found in VirusTotal database.</div>}
      {result && !result.notFound && !result.error && (
        <ResultBox>
          <div className="flex items-center gap-4">
            <div className={`text-2xl font-bold ${result.malicious > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {result.malicious}/{totalEngines}
            </div>
            <div className="text-sm text-slate-500">engines flagged as malicious</div>
          </div>
          <div className="flex gap-3 text-xs flex-wrap">
            <span className="text-red-500">{result.malicious} malicious</span>
            <span className="text-orange-400">{result.suspicious} suspicious</span>
            <span className="text-green-500">{result.harmless} clean</span>
            <span className="text-slate-400">{result.undetected} undetected</span>
          </div>
          <KVRow label="Reputation" value={result.reputation} />
          <KVRow label="Country" value={result.country} />
          <KVRow label="AS Owner" value={result.asOwner} />
          <KVRow label="Registrar" value={result.registrar} />
          <KVRow label="Created" value={result.creationDate} />
          <KVRow label="File Type" value={result.fileType} />
          <KVRow label="File Size" value={result.fileSize ? `${(result.fileSize/1024).toFixed(1)} KB` : null} />
          <TagRow label="Tags" tags={result.tags} />
          {result.engines?.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Flagging Engines</div>
              <div className="space-y-1">
                {result.engines.map((eng: any) => (
                  <div key={eng.engine} className="flex gap-3 text-xs">
                    <span className={`w-20 shrink-0 font-semibold ${eng.category === 'malicious' ? 'text-red-500' : 'text-orange-400'}`}>{eng.category}</span>
                    <span className="text-slate-500">{eng.engine}</span>
                    <span className="text-slate-400 truncate">{eng.result}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <a href={result.vtUrl} target="_blank" rel="noopener noreferrer"
            className="text-green-500 hover:underline text-xs">View full report on VirusTotal →</a>
        </ResultBox>
      )}
    </>
  );
}

// ── AbuseIPDB Tool ─────────────────────────────────────────────────────────────
function AbuseIPDBTool() {
  const [ip, setIp] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/abuseipdb?ip=${encodeURIComponent(ip.trim())}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-2">
        <input value={ip} onChange={e => setIp(e.target.value)} placeholder="1.2.3.4"
          className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none focus:border-red-400 placeholder:text-slate-400" />
        <button type="submit" disabled={loading}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
          {loading ? 'Checking…' : 'Check IP'}
        </button>
      </form>
      {error && <ErrorBox msg={error} />}
      {result && (
        <ResultBox>
          <div className="flex items-center gap-3">
            <div className={`text-3xl font-bold ${result.abuseScore > 50 ? 'text-red-500' : result.abuseScore > 20 ? 'text-orange-400' : 'text-green-500'}`}>
              {result.abuseScore}%
            </div>
            <div className="text-sm text-slate-500">abuse confidence score</div>
          </div>
          <KVRow label="ISP" value={result.isp} />
          <KVRow label="Domain" value={result.domain} />
          <KVRow label="Country" value={result.countryName} />
          <KVRow label="Usage Type" value={result.usageType} />
          <KVRow label="Total Reports" value={result.totalReports} />
          <KVRow label="Distinct Users" value={result.numDistinctUsers} />
          <KVRow label="Last Reported" value={result.lastReportedAt} />
          <KVRow label="Tor Exit Node" value={result.isTor ? 'Yes' : 'No'} />
          {result.reports?.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Recent Reports</div>
              {result.reports.slice(0, 4).map((r: any, i: number) => (
                <div key={i} className="p-2 bg-red-50 dark:bg-red-900/10 rounded-lg text-xs mb-1.5">
                  <div className="text-slate-500">{r.reportedAt}</div>
                  {r.comment && <div className="text-slate-600 dark:text-slate-300 mt-0.5">{r.comment}</div>}
                </div>
              ))}
            </div>
          )}
          <a href={result.abuseipdbUrl} target="_blank" rel="noopener noreferrer"
            className="text-red-500 hover:underline text-xs">View on AbuseIPDB →</a>
        </ResultBox>
      )}
    </>
  );
}

// ── GreyNoise Tool ─────────────────────────────────────────────────────────────
function GreyNoiseTool() {
  const [ip, setIp] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/greynoise?ip=${encodeURIComponent(ip.trim())}`);
      const json = await res.json();
      if (json.error && !json.seen === false) throw new Error(json.error);
      setResult(json);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-2">
        <input value={ip} onChange={e => setIp(e.target.value)} placeholder="1.2.3.4"
          className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none focus:border-slate-400 placeholder:text-slate-400" />
        <button type="submit" disabled={loading}
          className="bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
          {loading ? 'Checking…' : 'Check'}
        </button>
      </form>
      {error && <ErrorBox msg={error} />}
      {result && (
        <ResultBox>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${!result.seen ? 'bg-slate-400' : result.classification === 'malicious' ? 'bg-red-500' : result.classification === 'benign' ? 'bg-green-500' : 'bg-yellow-400'}`} />
            <span className="font-semibold capitalize">
              {!result.seen ? 'Not seen in GreyNoise' : result.classification ?? 'Unknown classification'}
            </span>
          </div>
          {result.noise && <div className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg inline-block">Internet background noise scanner</div>}
          {result.riot && <div className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg inline-block">RIOT: Benign service (Cloudflare, Google, etc)</div>}
          <KVRow label="Name" value={result.name} />
          <KVRow label="Last Seen" value={result.lastSeen} />
          <KVRow label="Message" value={result.message} />
          {result.greynoiseUrl && (
            <a href={result.greynoiseUrl} target="_blank" rel="noopener noreferrer"
              className="text-slate-500 hover:underline text-xs">View on GreyNoise →</a>
          )}
        </ResultBox>
      )}
    </>
  );
}

// ── OTX Tool ───────────────────────────────────────────────────────────────────
function OTXTool() {
  const [q, setQ] = useState('');
  const [qType, setQType] = useState<'domain' | 'ip' | 'url' | 'file'>('domain');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/otx?q=${encodeURIComponent(q.trim())}&type=${qType}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="flex gap-2 mb-3 flex-wrap">
        {(['domain', 'ip', 'url', 'file'] as const).map(t => (
          <button key={t} type="button" onClick={() => setQType(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${qType === t ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
            {t === 'domain' ? '🌐 Domain' : t === 'ip' ? '🔌 IP' : t === 'url' ? '🔗 URL' : '📄 File Hash'}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-2">
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder={qType === 'file' ? 'SHA256 hash' : qType === 'ip' ? '1.2.3.4' : qType === 'url' ? 'https://...' : 'example.com'}
          className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none focus:border-blue-400 placeholder:text-slate-400" />
        <button type="submit" disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
          {loading ? 'Fetching…' : 'Lookup'}
        </button>
      </form>
      {error && <ErrorBox msg={error} />}
      {result && (
        <ResultBox>
          <div className="flex items-center gap-3">
            <div className={`text-2xl font-bold ${result.pulseCount > 5 ? 'text-red-500' : result.pulseCount > 0 ? 'text-orange-400' : 'text-green-500'}`}>
              {result.pulseCount}
            </div>
            <div className="text-sm text-slate-500">threat intel pulses</div>
          </div>
          <KVRow label="Country" value={result.country} />
          <KVRow label="City" value={result.city} />
          <KVRow label="ASN" value={result.asn} />
          <KVRow label="Reputation" value={result.reputation} />
          <KVRow label="Malware Samples" value={result.malwareCount > 0 ? result.malwareCount : null} />
          {result.pulses?.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Recent Threat Pulses</div>
              {result.pulses.map((p: any) => (
                <div key={p.id} className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl mb-2">
                  <div className="font-semibold text-sm text-orange-700 dark:text-orange-300">{p.name}</div>
                  {p.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{p.description}</div>}
                  <div className="text-xs text-slate-400 mt-1">{p.author} · TLP: {p.tlp} · {p.modified?.slice(0,10)}</div>
                  <TagRow label="" tags={p.tags?.slice(0, 5)} />
                </div>
              ))}
            </div>
          )}
          <a href={result.otxUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-500 hover:underline text-xs">View on OTX AlienVault →</a>
        </ResultBox>
      )}
    </>
  );
}
