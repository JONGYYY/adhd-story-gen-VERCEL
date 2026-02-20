'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { 
  Plus, 
  LayoutDashboard, 
  BarChart3, 
  Rocket, 
  Library,
  Settings,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onLinkClick?: () => void;
}

const navItems = [
  { href: '/create', label: 'Create', icon: Plus },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/campaigns', label: 'Campaigns', icon: Rocket },
  { href: '/library', label: 'Library', icon: Library },
];

export function Sidebar({ onLinkClick }: SidebarProps = {}) {
  const pathname = usePathname();
  const { user } = useAuth();

  // Get username from email (before @ symbol)
  const username = user?.email?.split('@')[0] || 'User';
  
  // Get first letter for avatar
  const avatarLetter = username.charAt(0).toUpperCase();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-black border-r border-border/50 flex flex-col z-50">
      {/* Logo Section */}
      <div className="p-6 border-b border-border/50">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent group-hover:from-primary group-hover:to-orange-400 transition-all duration-300">
            Taleo
          </span>
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200',
                'hover:scale-[1.02] hover:translate-x-1',
                isActive
                  ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-primary border border-primary/30 shadow-lg shadow-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 transition-transform duration-200',
                isActive && 'scale-110'
              )} />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="p-4 border-t border-border/50">
        <Link
          href="/settings"
          onClick={onLinkClick}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200',
            'hover:scale-[1.02] hover:translate-x-1',
            pathname?.startsWith('/settings')
              ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-primary border border-primary/30 shadow-lg shadow-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
          )}
        >
          <Settings className="w-5 h-5" />
          <span className="text-sm">Settings</span>
        </Link>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white font-bold shadow-lg">
            {avatarLetter}
          </div>
          
          {/* User Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {username}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              Pro Account
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
