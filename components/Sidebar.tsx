'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Globe, 
  Navigation, // New icon for the Transit & Logistics radar link
  Users, 
  FileText, 
  Network, 
  Newspaper, 
  Settings, 
  Building2, 
  Image as ImageIcon, 
  Scale, 
  Landmark 
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Threat Intel Map', href: '/dashboard/threat-intelligence', icon: Globe },
  { name: 'Transit & Logistics', href: '/dashboard/transit-logistics', icon: Navigation }, // Integrated link
  { name: 'Human Intel', href: '/dashboard/actors', icon: Users },
  { name: 'Document Archives', href: '/dashboard/documents', icon: FileText },
  { name: 'Forensic Mapper', href: '/dashboard/mapper', icon: Network },
  { name: 'Government Intel', href: '/dashboard/government', icon: Landmark },
  { name: 'Image Intel', href: '/dashboard/image', icon: ImageIcon },
  { name: 'Business Intel', href: '/dashboard/business', icon: Building2 },
  { name: 'Judicial Intel', href: '/dashboard/judicial', icon: Scale },
  { name: 'News Feed', href: '/dashboard/feed', icon: Newspaper },
  { name: 'Tools', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 min-h-screen border-r flex flex-col bg-white dark:bg-slate-950 border-pink-100 dark:border-slate-800">
      
      {/* Girly Sparkly Header */}
      <div className="p-6 text-3xl font-bold tracking-widest text-center border-b border-pink-100 dark:border-slate-800 relative">
        <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent sparkle">
          Casey's Homefront
        </span>
        <div className="absolute -top-2 -right-1 text-2xl animate-bounce">✨</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-4 px-5 py-3.5 rounded-2xl text-sm font-medium transition-all relative overflow-hidden ${
                isActive 
                  ? 'bg-pink-100 dark:bg-slate-900 text-pink-600 dark:text-pink-400 border border-pink-300 shadow-md' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-pink-50 dark:hover:bg-slate-900 hover:text-pink-500'
              }`}
            >
              <IconComponent size={20} className={isActive ? 'text-pink-500' : 'group-hover:scale-110 transition-transform'} />
              <span>{item.name}</span>
              
              {/* Hover sparkle */}
              <div className="absolute right-4 text-pink-300 opacity-0 group-hover:opacity-100 transition-all">✨</div>
            </Link>
          );
        })}
      </nav>
      
      {/* Footer */}
      <div className="p-6 border-t border-pink-100 dark:border-slate-800 text-center">
        <p className="text-xs text-pink-400 dark:text-slate-500">Personal Intel Suite • v1.0</p>
      </div>
    </div>
  );
}