'use client';

import { cn } from '@/lib/utils';
import { SocialPlatform } from '@/lib/social-media/types';
import { motion } from 'framer-motion';

interface PlatformSelectorProps {
  selected: SocialPlatform;
  onSelect: (platform: SocialPlatform) => void;
  className?: string;
}

const platforms = [
  {
    id: 'tiktok' as SocialPlatform,
    label: 'TikTok',
    icon: '🎵',
    color: 'from-pink-500 to-cyan-500',
    activeColor: 'from-pink-500/20 to-cyan-500/20',
  },
  {
    id: 'youtube' as SocialPlatform,
    label: 'YouTube',
    icon: '▶️',
    color: 'from-red-500 to-red-600',
    activeColor: 'from-red-500/20 to-red-600/20',
  },
];

export function PlatformSelector({ selected, onSelect, className }: PlatformSelectorProps) {
  const selectedIndex = platforms.findIndex(p => p.id === selected);

  return (
    <div className={cn('relative inline-flex p-1 rounded-xl bg-muted/30 border border-border/50 backdrop-blur-sm', className)}>
      {/* Animated Background Slider */}
      <motion.div
        className="absolute inset-y-1 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30"
        initial={false}
        animate={{
          x: selectedIndex === 0 ? 4 : '100%',
          width: selectedIndex === 0 ? 'calc(50% - 8px)' : 'calc(50% - 8px)',
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
      />

      {/* Platform Buttons */}
      {platforms.map((platform, index) => {
        const isSelected = platform.id === selected;
        const Icon = platform.icon;

        return (
          <button
            key={platform.id}
            onClick={() => onSelect(platform.id)}
            className={cn(
              'relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200',
              'hover:scale-105 active:scale-95',
              isSelected
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {/* Platform Icon with Animation */}
            <motion.span
              className="text-lg"
              animate={{
                scale: isSelected ? [1, 1.2, 1] : 1,
                rotate: isSelected ? [0, 360] : 0,
              }}
              transition={{
                duration: 0.5,
                ease: 'easeInOut',
              }}
            >
              {Icon}
            </motion.span>

            {/* Platform Label */}
            <span>{platform.label}</span>

            {/* Selection Indicator */}
            {isSelected && (
              <motion.div
                className={cn(
                  'absolute inset-0 rounded-lg bg-gradient-to-br opacity-10 -z-10',
                  platform.color
                )}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

