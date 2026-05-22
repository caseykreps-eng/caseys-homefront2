'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Load saved preference or system default
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = saved === 'dark' || (!saved && systemDark);

    setIsDark(initialDark);
    if (initialDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);

    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className="p-10">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent mb-12">
        ⚙️ Settings
      </h1>

      <div className="max-w-md bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
        <h2 className="text-xl font-bold mb-6">Appearance</h2>
        
        <div 
          onClick={toggleTheme}
          className="flex justify-between items-center p-6 rounded-2xl border border-pink-200 dark:border-slate-700 cursor-pointer hover:bg-pink-50 dark:hover:bg-slate-700 transition-all"
        >
          <div>
            <div className="font-medium">Dark Mode</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Auto-detects system preference</div>
          </div>
          <div className={`w-14 h-8 rounded-full relative flex items-center transition-all ${isDark ? 'bg-pink-500' : 'bg-slate-300'}`}>
            <div className={`absolute w-6 h-6 bg-white rounded-full shadow-md transition-all ${isDark ? 'translate-x-7' : 'translate-x-1'}`} />
          </div>
        </div>
      </div>
    </div>
  );
}