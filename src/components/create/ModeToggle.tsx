'use client';

import { Sparkles, Grid3x3 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ModeToggleProps {
  currentMode: 'single' | 'batch';
}

export function ModeToggle({ currentMode }: ModeToggleProps) {
  const router = useRouter();

  const handleModeChange = (mode: 'single' | 'batch') => {
    if (mode === 'single') {
      router.push('/create');
    } else {
      router.push('/create/batch');
    }
  };

  return (
    <div className="flex items-center justify-center mb-12">
      <div className="inline-flex items-center bg-muted/30 backdrop-blur-sm rounded-2xl p-1.5 border border-border/50">
        <button
          onClick={() => handleModeChange('single')}
          className={`
            relative px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2
            ${currentMode === 'single'
              ? 'text-white shadow-lg'
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          {/* Active background */}
          {currentMode === 'single' && (
            <span className="absolute inset-0 bg-primary rounded-xl animate-in fade-in zoom-in-95 duration-300" />
          )}
          
          {/* Content */}
          <Sparkles className="w-5 h-5 relative z-10" />
          <span className="relative z-10">Single Video</span>
        </button>

        <button
          onClick={() => handleModeChange('batch')}
          className={`
            relative px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2
            ${currentMode === 'batch'
              ? 'text-white shadow-lg'
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          {/* Active background */}
          {currentMode === 'batch' && (
            <span className="absolute inset-0 bg-primary rounded-xl animate-in fade-in zoom-in-95 duration-300" />
          )}
          
          {/* Content */}
          <Grid3x3 className="w-5 h-5 relative z-10" />
          <span className="relative z-10">Batch Creator</span>
          
          {/* Premium badge */}
          <span className="relative z-10 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30">
            PRO
          </span>
        </button>
      </div>
    </div>
  );
}

