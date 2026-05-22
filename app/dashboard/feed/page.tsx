'use client';

import { useLiveData } from '../../../hooks/useLiveData';
import { useState } from 'react';

const categories = [
  { label: "All", value: "all" },
  { label: "Conflict", value: "conflict" },
  { label: "Naval", value: "naval" },
  { label: "Military", value: "military" },
  { label: "General", value: "general" },
];

const getSentiment = (title = "") => {
  const text = title.toLowerCase();
  if (text.includes("strike") || text.includes("attack") || text.includes("explosion") || 
      text.includes("killed") || text.includes("tension") || text.includes("escalation")) {
    return { label: "Negative", color: "bg-red-100 text-red-700 border-red-300" };
  }
  if (text.includes("peace") || text.includes("agreement") || text.includes("aid") || 
      text.includes("talks") || text.includes("ceasefire")) {
    return { label: "Positive", color: "bg-green-100 text-green-700 border-green-300" };
  }
  return { label: "Neutral", color: "bg-slate-100 text-slate-700 border-slate-300" };
};

const getRelativeTime = (timestamp = "") => {
  if (!timestamp || timestamp === "Recent" || timestamp === "Live") return "Just now";
  // Simple fallback
  return timestamp;
};

export default function NewsFeedPage() {
  const { news = [] } = useLiveData();
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredNews = activeFilter === "all" 
    ? news 
    : news.filter(item => {
        const t = (item.title || "").toLowerCase();
        if (activeFilter === "conflict") return t.includes("strike") || t.includes("missile") || t.includes("drone");
        if (activeFilter === "naval") return t.includes("naval") || t.includes("usv");
        if (activeFilter === "military") return t.includes("air force") || t.includes("nato");
        return true;
      });

  return (
    <div className="p-8 bg-[#fff0f8] dark:bg-[#0f172a] min-h-full">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent mb-2">
          🌍 Live News Feed
        </h1>
        <p className="text-pink-600 dark:text-pink-300 text-xl mb-8">With sentiment + relative time</p>

        {/* Filters */}
        <div className="flex gap-3 mb-10 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveFilter(cat.value)}
              className={`px-6 py-3 rounded-2xl text-sm font-medium transition-all ${
                activeFilter === cat.value 
                  ? 'bg-pink-500 text-white shadow-lg' 
                  : 'bg-white dark:bg-slate-800 border border-pink-200 hover:border-pink-400'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {filteredNews.length > 0 ? filteredNews.map((item) => {
            const sentiment = getSentiment(item.title);
            return (
              <a 
                key={item.id}
                href={item.url || '#'} 
                target="_blank"
                className="block p-8 rounded-3xl bg-white dark:bg-slate-800 border border-purple-200 hover:border-purple-400 hover:shadow-2xl transition-all group"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="text-2xl font-medium leading-tight group-hover:text-purple-600 transition-colors flex-1">
                    {item.title || "Untitled Event"}
                  </div>
                  <span className={`px-4 py-1.5 text-xs font-medium rounded-full border ${sentiment.color}`}>
                    {sentiment.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-6 text-sm text-slate-500">
                  <span className="font-semibold text-purple-600">{item.source || "Unknown Source"}</span>
                  <span>•</span>
                  <span className="font-mono">{getRelativeTime(item.timestamp)}</span>
                </div>
              </a>
            );
          }) : (
            <div className="p-20 text-center text-slate-500 text-xl italic">
              No matching headlines right now...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}