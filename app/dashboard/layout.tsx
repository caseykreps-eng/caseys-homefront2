'use client';

import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar - Only rendered here */}
      <div className="flex-shrink-0">
        <Sidebar />
      </div>
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#fff0f8] dark:bg-zinc-950">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}