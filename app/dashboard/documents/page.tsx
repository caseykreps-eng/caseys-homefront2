'use client';

import { useState } from 'react';

export default function DocumentIntelPage() {
  const [query, setQuery] = useState('');

  const runMetaSearch = () => {
    if (!query) return;
    const dork = `site:documentcloud.org OR site:offshoreleaks.icij.org OR site:courtlistener.com OR site:scribd.com "${query}"`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(dork)}`, '_blank');
  };

  return (
    <div className="p-10 bg-[#fff0f8] min-h-screen">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent mb-10">
        📂 Document Archive Mining
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-pink-200 p-8 rounded-3xl">
          <h2 className="text-pink-600 font-bold mb-4">FEDERATED SCANNER</h2>
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Target name / company / ID..."
            className="w-full bg-pink-50 border border-pink-200 p-4 rounded-2xl mb-4 focus:outline-none focus:border-pink-400"
          />
          <button onClick={runMetaSearch} className="w-full bg-pink-500 hover:bg-pink-600 text-white py-4 rounded-2xl font-bold">
            LAUNCH FEDERATED SEARCH
          </button>
        </div>

        <div className="bg-white border border-purple-200 p-8 rounded-3xl">
          <h2 className="text-purple-600 font-bold mb-4">OCCRP ALEPH ENGINE</h2>
          <p className="text-slate-600 mb-6">The pro tool for leaks, offshore records & court files.</p>
          <a href={`https://aleph.occrp.org/search?q=${encodeURIComponent(query)}`} target="_blank" className="block w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-bold text-center">
            OPEN ALEPH INVESTIGATIVE ENGINE ↗
          </a>
        </div>
      </div>
    </div>
  );
}