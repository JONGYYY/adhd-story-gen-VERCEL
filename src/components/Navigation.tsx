'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/auth-context';
import { Menu } from 'lucide-react';
import { cn } from './utils';

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Create', href: '/create' },
  { label: 'Library', href: '/library' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Settings', href: '/settings' },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  const isLoggedIn = !!user;
  const userEmail = user?.email;

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Mount animation
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <header 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        "border-b border-border/50",
        hasScrolled 
          ? "bg-background/95 backdrop-blur-xl shadow-lg shadow-black/5" 
          : "bg-background/80 backdrop-blur-lg",
        mounted ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      )}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      <div className="container-wide relative">
        <div className={cn(
          "grid grid-cols-3 items-center transition-all duration-300",
          hasScrolled ? "h-14" : "h-16"
        )}>
          {/* Left: Mobile Menu + Logo */}
          <div className="flex items-center gap-2">
            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hover:bg-primary/10 hover:scale-110 transition-all duration-200"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent 
                side="left" 
                className="w-[300px] bg-background/98 backdrop-blur-xl border-border/50"
              >
                <SheetHeader>
                  <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    StoryGen AI
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-2 mt-8">
                  {isLoggedIn ? (
                    <>
                      {navItems.map((item, i) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                            "hover:bg-primary/10 hover:translate-x-1",
                            pathname === item.href && "bg-primary/10 text-primary"
                          )}
                          style={{ animationDelay: `${i * 50}ms` }}
                          onClick={() => setIsOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          handleLogout();
                        }}
                        className="px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 hover:translate-x-1 transition-all duration-200 text-left"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth/login"
                        className="px-4 py-3 rounded-xl text-sm font-medium hover:bg-primary/10 transition-all duration-200"
                        onClick={() => setIsOpen(false)}
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/auth/signup"
                        className="btn-orange"
                        onClick={() => setIsOpen(false)}
                      >
                        Get Started
                      </Link>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link 
              href="/" 
              className="flex items-center gap-2 group"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-lg rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className={cn(
                  "relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center",
                  "group-hover:scale-110 group-hover:rotate-6 transition-all duration-300",
                  "shadow-lg shadow-primary/20"
                )}>
                  <span className="text-white font-bold text-sm group-hover:scale-110 transition-transform duration-300">
                    S
                  </span>
                </div>
              </div>
              <span className={cn(
                "font-bold text-xl hidden sm:inline-block",
                "group-hover:text-primary transition-colors duration-300"
              )}>
                StoryGen AI
              </span>
            </Link>
          </div>

          {/* Center: Desktop Navigation (Truly Centered) */}
          {isLoggedIn && (
            <nav className="hidden lg:flex items-center justify-center">
              <div className="flex items-center gap-1 bg-muted/30 backdrop-blur-sm rounded-full px-2 py-1.5 border border-border/50">
                {navItems.map((item, i) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                        "hover:-translate-y-0.5 hover:scale-105",
                        isActive 
                          ? "text-white" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      style={{
                        animation: mounted ? `fadeInUp 0.5s ease-out ${i * 0.1}s both` : 'none'
                      }}
                    >
                      {/* Active background */}
                      {isActive && (
                        <span className="absolute inset-0 bg-primary rounded-full animate-in fade-in zoom-in-95 duration-300" />
                      )}
                      
                      {/* Text */}
                      <span className="relative z-10">{item.label}</span>
                      
                      {/* Hover underline */}
                      <span className={cn(
                        "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary rounded-full transition-all duration-300",
                        "opacity-0 w-0",
                        !isActive && "group-hover:opacity-100 group-hover:w-3/4"
                      )} />
                    </Link>
                  );
                })}
              </div>
            </nav>
          )}

          {/* Right: User Avatar / Auth CTAs */}
          <div className="flex items-center justify-end gap-3">
            {!loading && isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative group">
                    {/* Glow ring on hover */}
                    <div className="absolute inset-0 rounded-full bg-primary/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-110" />
                    
                    {/* Avatar */}
                    <div className={cn(
                      "relative h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center",
                      "ring-2 ring-transparent group-hover:ring-primary/50 transition-all duration-300",
                      "group-hover:scale-110 shadow-lg"
                    )}>
                      <span className="text-sm font-bold text-white">
                        {userEmail ? userEmail[0].toUpperCase() : 'U'}
                      </span>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-56 bg-card/98 backdrop-blur-xl border-border/50 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">Account</p>
                      <p className="text-xs text-muted-foreground">{userEmail}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-primary/10 transition-colors">
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-primary/10 transition-colors">
                    <Link href="/settings/billing">Billing</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-red-500 cursor-pointer hover:bg-red-500/10 transition-colors" 
                    onClick={handleLogout}
                  >
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : loading ? (
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  asChild 
                  className="hidden sm:inline-flex hover:bg-primary/10 hover:text-primary transition-all duration-200"
                >
                  <Link href="/auth/login">Sign in</Link>
                </Button>
                <Link 
                  href="/auth/signup" 
                  className={cn(
                    "btn-orange text-sm px-6 py-2 relative overflow-hidden group",
                    "hover:scale-105 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
                  )}
                >
                  <span className="relative z-10">Get Started</span>
                  {/* Shine effect */}
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
