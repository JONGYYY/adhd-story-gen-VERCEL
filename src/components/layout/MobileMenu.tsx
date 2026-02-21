'use client';

import { useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';

interface MobileMenuProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileMenu({ isOpen, onToggle }: MobileMenuProps) {
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={onToggle}
        className="fixed top-6 left-6 z-[100] w-10 h-10 flex items-center justify-center rounded-xl bg-[#151515] border border-border/50 hover:bg-[#1a1a1a] transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-foreground" />
        ) : (
          <Menu className="w-5 h-5 text-foreground" />
        )}
      </button>

      {/* Overlay & Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Semi-transparent overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onToggle}
              className="fixed inset-0 bg-black/50 z-[90]"
            />

            {/* Sliding Sidebar */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 z-[95] w-[280px] overflow-y-auto"
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
