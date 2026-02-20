'use client';

import { LayoutGrid, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LayoutMode = 'single' | 'large';

interface LayoutToggleProps {
  selected: LayoutMode;
  onSelect: (mode: LayoutMode) => void;
}

export function LayoutToggle({ selected, onSelect }: LayoutToggleProps) {
  return (
    <div className="flex items-center gap-2 p-1 rounded-xl border-2 border-border bg-background">
      <button
        onClick={() => onSelect('single')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
          selected === 'single'
            ? 'bg-primary text-white shadow-lg shadow-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
        title="Single View - Main graph with mini metrics"
      >
        <div className="flex flex-col items-center gap-0.5">
          {/* Icon: 1 big box + 3 dots */}
          <div className="flex items-center gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
          </div>
          <div className="w-5 h-3 border-2 border-current rounded-sm mt-0.5" />
        </div>
        <span className="text-sm font-medium hidden sm:inline">Single</span>
      </button>

      <button
        onClick={() => onSelect('large')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
          selected === 'large'
            ? 'bg-primary text-white shadow-lg shadow-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
        title="Large View - Multiple graphs in grid"
      >
        <LayoutGrid className="w-4 h-4" />
        <span className="text-sm font-medium hidden sm:inline">Large</span>
      </button>
    </div>
  );
}
