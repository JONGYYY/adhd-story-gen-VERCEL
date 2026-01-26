'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export function Navigation() {
  const [isOpen, setIsOpen] = React.useState(false);
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const isLoggedIn = !!user;
  const userEmail = user?.email;

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 backdrop-blur-elevo bg-background/80">
      <div className="container-wide">
        <div className="flex h-16 items-center justify-between">
          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] bg-background">
              <SheetHeader>
                <SheetTitle className="text-2xl font-bold">StoryGen AI</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-8">
                {isLoggedIn ? (
                  <>
                    <Link
                      href="/dashboard"
                      className="text-sm font-medium hover:text-primary transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/create"
                      className="text-sm font-medium hover:text-primary transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Create
                    </Link>
                    <Link
                      href="/library"
                      className="text-sm font-medium hover:text-primary transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Library
                    </Link>
                    <Link
                      href="/analytics"
                      className="text-sm font-medium hover:text-primary transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Analytics
                    </Link>
                    <Link
                      href="/settings"
                      className="text-sm font-medium hover:text-primary transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        handleLogout();
                      }}
                      className="text-sm font-medium text-red-500 hover:text-red-400 transition-colors text-left"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/login"
                      className="text-sm font-medium hover:text-primary transition-colors"
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
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-xl hidden sm:inline-block">StoryGen AI</span>
          </Link>

          {/* Desktop Navigation */}
          {isLoggedIn && (
            <nav className="hidden lg:flex items-center gap-8">
              <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link href="/create" className="text-sm font-medium hover:text-primary transition-colors">
                Create
              </Link>
              <Link href="/library" className="text-sm font-medium hover:text-primary transition-colors">
                Library
              </Link>
              <Link href="/analytics" className="text-sm font-medium hover:text-primary transition-colors">
                Analytics
              </Link>
              <Link href="/settings" className="text-sm font-medium hover:text-primary transition-colors">
                Settings
              </Link>
            </nav>
          )}

          {/* Right side CTAs */}
          <div className="flex items-center gap-4">
            {!loading && isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full h-10 w-10 p-0">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-primary">
                      <span className="text-sm font-bold text-white">
                        {userEmail ? userEmail[0].toUpperCase() : 'U'}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">Account</p>
                      <p className="text-xs text-muted-foreground">{userEmail}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings/billing">Billing</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-500" onClick={handleLogout}>
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : loading ? (
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            ) : (
              <>
                <Button variant="ghost" asChild className="hidden sm:inline-flex">
                  <Link href="/auth/login">Sign in</Link>
                </Button>
                <Link href="/auth/signup" className="btn-orange text-sm px-6 py-2">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
