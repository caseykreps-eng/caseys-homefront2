'use client';

import { useState, useEffect } from 'react';

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

      </div>
    </div>
  );
}
