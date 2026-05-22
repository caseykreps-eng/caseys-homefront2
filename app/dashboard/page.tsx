'use client';

import { useLiveData } from '../../hooks/useLiveData';
import Link from 'next/link';

export default function DashboardPage() {
  const { events = [], navalEvents = [], watchEvents = [], militaryFlights = [] } = useLiveData();

  return (
    <div className="p-8 bg-[#fff0f8] min-h-full">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent mb-12">
        Casey's Homefront
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/dashboard/map" className="group">
          <div className="bg-white p-8 rounded-3xl border border-pink-200 hover:border-pink-400 transition-all cursor-pointer">
            <h2 className="text-pink-600 font-bold mb-2">💥 CONFLICT EVENTS</h2>
            <p className="text-6xl font-bold text-pink-500">{events.length}</p>
            <p className="text-xs text-pink-400 mt-2 group-hover:underline">View on Map →</p>
          </div>
        </Link>

        <Link href="/dashboard/map" className="group">
          <div className="bg-white p-8 rounded-3xl border border-teal-200 hover:border-teal-400 transition-all cursor-pointer">
            <h2 className="text-teal-600 font-bold mb-2">⚓ NAVAL ACTIVITY</h2>
            <p className="text-6xl font-bold text-teal-500">{navalEvents.length}</p>
            <p className="text-xs text-teal-400 mt-2 group-hover:underline">View on Map →</p>
          </div>
        </Link>

        <Link href="/dashboard/map" className="group">
          <div className="bg-white p-8 rounded-3xl border border-purple-200 hover:border-purple-400 transition-all cursor-pointer">
            <h2 className="text-purple-600 font-bold mb-2">👀 WATCH ALERTS</h2>
            <p className="text-6xl font-bold text-purple-500">{watchEvents.length}</p>
            <p className="text-xs text-purple-400 mt-2 group-hover:underline">View on Map →</p>
          </div>
        </Link>

        <Link href="/dashboard/map" className="group">
          <div className="bg-white p-8 rounded-3xl border border-orange-200 hover:border-orange-400 transition-all cursor-pointer">
            <h2 className="text-orange-600 font-bold mb-2">✈️ MILITARY FLIGHTS</h2>
            <p className="text-6xl font-bold text-orange-500">{militaryFlights.length}</p>
            <p className="text-xs text-orange-400 mt-2 group-hover:underline">View on Map →</p>
          </div>
        </Link>
      </div>
    </div>
  );
}