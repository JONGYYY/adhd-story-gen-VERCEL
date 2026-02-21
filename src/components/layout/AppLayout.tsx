'use client';

import { Sidebar } from './Sidebar';
import { ReactNode, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-xl bg-card border-2 border-border shadow-lg"
      >
        {mobileMenuOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Always fixed and sticky */}
      <div
        className={cn(
          'lg:block transition-transform duration-300',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <Sidebar onLinkClick={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main Content - Add left margin to account for fixed sidebar */}
      <main className="flex-1 lg:ml-64 w-full min-h-screen">
        {children}
      </main>
    </div>
  );
}
