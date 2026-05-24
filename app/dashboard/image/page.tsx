'use client';

import { useState, useRef, useCallback } from 'react';

/* ─── EXIF parser (client-side via exifr) ─── */
async function parseExif(file: File) {
  const exifr = (await import('exifr')).default;
  return exifr.parse(file, {
    tiff: true, exif: true, gps: true, icc: false,
    iptc: true, xmp: true,
  } as any);
}

/* ─── types ─── */
interface OpenverseResult {
  id: string; title: string; creator: string; creatorUrl: string | null;
  license: string; licenseUrl: string | null; source: string;
  url: string | null; foreignUrl: string | null; thumbnail: string | null;
  width: number | null; height: number | null; tags: string[];
}

type Tab = 'exif' | 'openverse';

/* ─────────────────────────────────────────── */
export default function ImageIntelPage() {
  const [tab, setTab] = useState<Tab>('exif');

  /* ── EXIF state ── */
  const [dragOver, setDragOver] = useState(false);
  const [exifData, setExifData] = useState<Record<string, any> | null>(null);
  const [exifFile, setExifFile] = useState<{ name: string; size: number; type: string } | null>(null);
  const [exifPreview, setExifPreview] = useState<string | null>(null);
  const [exifLoading, setExifLoading] = useState(false);
  const [exifError, setExifError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { setExifError('Please drop an image file.'); return; }
    setExifLoading(true); setExifError(''); setExifData(null);
    setExifFile({ name: file.name, size: file.size, type: file.type });
    setExifPreview(URL.createObjectURL(file));
    try {
      const data = await parseExif(file);
      setExifData(data ?? {});
    } catch (e: any) {
      setExifError(e.message ?? 'Failed to parse EXIF data.');
    } finally {
      setExifLoading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  /* ── Openverse state ── */
  const [ovQuery, setOvQuery] = useState('');
  const [ovResults, setOvResults] = useState<OpenverseResult[]>([]);
  const [ovLoading, setOvLoading] = useState(false);
  const [ovError, setOvError] = useState('');
  const [ovCount, setOvCount] = useState(0);
  const [ovSelected, setOvSelected] = useState<OpenverseResult | null>(null);

  const searchOpenverse = async (q = ovQuery) => {
    if (!q.trim()) return;
    setOvLoading(true); setOvError(''); setOvResults([]); setOvSelected(null);
    try {
      const res = await fetch(`/api/openverse?q=${encodeURIComponent(q)}&type=images`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setOvResults(json.results ?? []);
      setOvCount(json.count ?? 0);
    } catch (e: any) {
      setOvError(e.message);
    } finally {
      setOvLoading(false);
    }
  };

  /* ── helpers ── */
  const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(2)} MB`;
  const formatExifVal = (v: any): string => {
    if (v == null) return '—';
    if (v instanceof Date) return v.toISOString().replace('T', ' ').slice(0, 19);
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const EXIF_SECTIONS: { label: string; keys: string[] }[] = [
    { label: '📷 Camera', keys: ['Make','Model','Software','LensMake','LensModel','LensSpecification'] },
    { label: '⚙️ Settings', keys: ['ExposureTime','FNumber','ISO','FocalLength','Flash','WhiteBalance','MeteringMode','ExposureProgram','ExposureMode','ExposureBiasValue','ShutterSpeedValue','ApertureValue'] },
    { label: '📐 Image', keys: ['ImageWidth','ImageHeight','Orientation','ColorSpace','XResolution','YResolution','BitsPerSample'] },
    { label: '📅 Timestamps', keys: ['DateTimeOriginal','DateTime','DateTimeDigitized','CreateDate','ModifyDate','GPSDateStamp','GPSTimeStamp'] },
    { label: '📍 GPS', keys: ['latitude','longitude','GPSAltitude','GPSAltitudeRef','GPSImgDirection','GPSImgDirectionRef','GPSSpeed','GPSSpeedRef','GPSDestBearing'] },
    { label: '👤 Creator / IPTC', keys: ['Artist','Copyright','Creator','Author','Description','Caption','Keywords','City','State','Country','Source','Credit'] },
  ];

  const gpsLat = exifData?.latitude;
  const gpsLon = exifData?.longitude;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'exif',      label: '🔍 EXIF / Metadata' },
    { id: 'openverse', label: '🖼️ Openverse Search' },
  ];

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100">
      <div className="mb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
          🖼️ Image Intelligence
        </h1>
        <p className="text-slate-400 text-sm mt-1">EXIF metadata extraction · Openverse CC media search</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 ${
              tab === t.id
                ? 'bg-slate-800 text-white border-violet-400'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: EXIF ── */}
      {tab === 'exif' && (
        <div>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-6 ${
              dragOver
                ? 'border-violet-400 bg-violet-950/30'
                : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
            }`}
          >
            <div className="text-4xl mb-3">📂</div>
            <p className="text-slate-300 font-semibold">Drop an image here, or click to browse</p>
            <p className="text-slate-500 text-sm mt-1">JPEG, PNG, TIFF, HEIC, WebP · metadata parsed in-browser, nothing uploaded</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </div>

          {exifLoading && (
            <div className="flex items-center gap-3 text-slate-400 py-6">
              <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              Parsing metadata…
            </div>
          )}
          {exifError && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm mb-4">⚠️ {exifError}</div>
          )}

          {exifData && exifFile && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Preview + file info */}
              <div className="lg:col-span-1 space-y-4">
                {exifPreview && (
                  <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
                    <img src={exifPreview} alt="Preview" className="w-full object-contain max-h-64 bg-slate-900" />
                  </div>
                )}
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-2 text-sm">
                  <div className="font-semibold text-white mb-2">📄 File Info</div>
                  <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="text-slate-200 text-right truncate ml-2 max-w-[180px]">{exifFile.name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Size</span><span className="text-slate-200">{formatBytes(exifFile.size)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Type</span><span className="text-slate-200">{exifFile.type}</span></div>
                </div>

                {/* GPS map link */}
                {gpsLat != null && gpsLon != null && (
                  <div className="bg-emerald-900/30 border border-emerald-700 rounded-2xl p-4 text-sm">
                    <div className="font-semibold text-emerald-300 mb-2">📍 GPS Location Found</div>
                    <div className="text-slate-300 font-mono text-xs mb-3">
                      {Number(gpsLat).toFixed(6)}, {Number(gpsLon).toFixed(6)}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <a href={`https://maps.google.com/?q=${gpsLat},${gpsLon}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                        Google Maps ↗
                      </a>
                      <a href={`https://www.openstreetmap.org/?mlat=${gpsLat}&mlon=${gpsLon}&zoom=14`} target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                        OpenStreetMap ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* EXIF sections */}
              <div className="lg:col-span-2 space-y-4">
                {EXIF_SECTIONS.map(section => {
                  const rows = section.keys
                    .map(k => ({ key: k, val: exifData[k] }))
                    .filter(r => r.val != null);
                  if (!rows.length) return null;
                  return (
                    <div key={section.label} className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-800 border-b border-slate-700 text-sm font-semibold text-slate-300">
                        {section.label}
                      </div>
                      <div className="divide-y divide-slate-800">
                        {rows.map(({ key, val }) => (
                          <div key={key} className="flex px-4 py-2 text-sm hover:bg-slate-800/40 transition-colors">
                            <span className="text-slate-400 w-44 flex-shrink-0 font-mono text-xs self-center">{key}</span>
                            <span className="text-slate-200 break-all">{formatExifVal(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Raw dump for anything not in sections */}
                {(() => {
                  const knownKeys = new Set(EXIF_SECTIONS.flatMap(s => s.keys));
                  const extra = Object.entries(exifData).filter(([k]) => !knownKeys.has(k) && exifData[k] != null);
                  if (!extra.length) return null;
                  return (
                    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-800 border-b border-slate-700 text-sm font-semibold text-slate-300">
                        🗂️ Additional Fields
                      </div>
                      <div className="divide-y divide-slate-800">
                        {extra.map(([key, val]) => (
                          <div key={key} className="flex px-4 py-2 text-sm hover:bg-slate-800/40 transition-colors">
                            <span className="text-slate-400 w-44 flex-shrink-0 font-mono text-xs self-center">{key}</span>
                            <span className="text-slate-200 break-all">{formatExifVal(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {Object.keys(exifData).length === 0 && (
                  <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-8 text-center text-slate-500">
                    No EXIF/metadata found in this file. It may have been stripped.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Openverse ── */}
      {tab === 'openverse' && (
        <div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-5">
            <p className="text-xs text-slate-400 mb-3">
              Search millions of openly-licensed images across Wikipedia, Flickr, museums, and more via <strong className="text-slate-200">Openverse</strong> (WordPress Foundation).
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={ovQuery}
                onChange={e => setOvQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchOpenverse()}
                placeholder="Search by subject, location, person, event…"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-400"
                autoFocus
              />
              <button
                onClick={() => searchOpenverse()}
                disabled={ovLoading}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {ovLoading ? '…' : 'Search'}
              </button>
            </div>
          </div>

          {ovError && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm mb-4">⚠️ {ovError}</div>
          )}

          {ovCount > 0 && (
            <p className="text-slate-400 text-sm mb-4">{ovCount.toLocaleString()} results · showing top {ovResults.length}</p>
          )}

          {/* Lightbox */}
          {ovSelected && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOvSelected(null)}>
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-white text-lg leading-tight pr-4">{ovSelected.title}</h3>
                  <button onClick={() => setOvSelected(null)} className="text-slate-400 hover:text-white text-xl shrink-0">✕</button>
                </div>
                {ovSelected.url && (
                  <img src={ovSelected.url} alt={ovSelected.title}
                    className="w-full rounded-xl object-contain max-h-96 bg-slate-800 mb-4"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <div className="space-y-2 text-sm">
                  {ovSelected.creator && <div><span className="text-slate-400">Creator: </span><span className="text-slate-200">{ovSelected.creator}</span></div>}
                  <div><span className="text-slate-400">License: </span>
                    {ovSelected.licenseUrl
                      ? <a href={ovSelected.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">{ovSelected.license.toUpperCase()}</a>
                      : <span className="text-slate-200">{ovSelected.license.toUpperCase()}</span>}
                  </div>
                  <div><span className="text-slate-400">Source: </span><span className="text-slate-200">{ovSelected.source}</span></div>
                  {(ovSelected.width && ovSelected.height) && (
                    <div><span className="text-slate-400">Dimensions: </span><span className="text-slate-200">{ovSelected.width} × {ovSelected.height}</span></div>
                  )}
                  {ovSelected.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ovSelected.tags.map(t => (
                        <span key={t} className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-lg">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-4 flex-wrap">
                  {ovSelected.foreignUrl && (
                    <a href={ovSelected.foreignUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm bg-violet-700 hover:bg-violet-600 text-white px-4 py-2 rounded-xl transition-colors">
                      View on source ↗
                    </a>
                  )}
                  {ovSelected.url && (
                    <a href={ovSelected.url} target="_blank" rel="noopener noreferrer" download
                      className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl transition-colors">
                      Direct image ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {ovResults.map(r => (
              <div key={r.id}
                onClick={() => setOvSelected(r)}
                className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden cursor-pointer hover:border-violet-500 hover:scale-105 transition-all group">
                {r.thumbnail ? (
                  <img src={r.thumbnail} alt={r.title}
                    className="w-full h-28 object-cover bg-slate-900"
                    onError={e => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-28 bg-slate-800 flex items-center justify-center text-2xl">🖼️</div>
                )}
                <div className="p-2">
                  <p className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">{r.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.license.toUpperCase()}</p>
                </div>
              </div>
            ))}
          </div>

          {!ovLoading && ovQuery && ovResults.length === 0 && !ovError && (
            <div className="text-slate-500 text-center py-10">No results for "{ovQuery}"</div>
          )}
          {!ovQuery && (
            <div className="text-slate-600 text-center py-10 text-sm">Search above to find openly-licensed images</div>
          )}
        </div>
      )}
    </div>
  );
}
