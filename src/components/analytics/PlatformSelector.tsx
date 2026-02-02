'use client';

import { cn } from '@/lib/utils';
import { SocialPlatform } from '@/lib/social-media/types';
import { motion } from 'framer-motion';

interface PlatformSelectorProps {
  selected: SocialPlatform;
  onSelect: (platform: SocialPlatform) => void;
  className?: string;
}

// Custom TikTok Icon Component (inspired by brand)
const TikTokIcon = ({ className, isActive }: { className?: string; isActive?: boolean }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <motion.path
      d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
      fill="url(#tiktok-gradient)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ 
        pathLength: isActive ? 1 : 0.8,
        opacity: 1,
        scale: isActive ? [1, 1.1, 1] : 1
      }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    />
    <defs>
      <linearGradient id="tiktok-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF0050" />
        <stop offset="50%" stopColor="#00F2EA" />
        <stop offset="100%" stopColor="#00F2EA" />
      </linearGradient>
    </defs>
  </svg>
);

// Custom YouTube Icon Component (inspired by brand)
const YouTubeIcon = ({ className, isActive }: { className?: string; isActive?: boolean }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <motion.path
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
      fill="url(#youtube-gradient)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ 
        pathLength: isActive ? 1 : 0.8,
        opacity: 1,
        scale: isActive ? [1, 1.05, 1] : 1
      }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    />
    <motion.path
      d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"
      fill="white"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1,
        scale: isActive ? [1, 1.2, 1] : 1
      }}
      transition={{ duration: 0.4, delay: 0.2, ease: "easeInOut" }}
    />
    <defs>
      <linearGradient id="youtube-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF0000" />
        <stop offset="100%" stopColor="#CC0000" />
      </linearGradient>
    </defs>
  </svg>
);

const platforms = [
  {
    id: 'tiktok' as SocialPlatform,
    label: 'TikTok',
    icon: TikTokIcon,
    color: 'from-pink-500 via-purple-500 to-cyan-500',
    hoverGlow: 'hover:shadow-pink-500/20',
    borderGlow: 'border-pink-500/30',
  },
  {
    id: 'youtube' as SocialPlatform,
    label: 'YouTube',
    icon: YouTubeIcon,
    color: 'from-red-600 to-red-500',
    hoverGlow: 'hover:shadow-red-500/20',
    borderGlow: 'border-red-500/30',
  },
];

export function PlatformSelector({ selected, onSelect, className }: PlatformSelectorProps) {
  const selectedIndex = platforms.findIndex(p => p.id === selected);

  return (
    <div className={cn(
      'relative inline-flex gap-3 p-1.5 rounded-2xl bg-background/80 border border-border/50 backdrop-blur-md shadow-xl',
      className
    )}>
      {/* Animated Background Glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-20 blur-xl -z-10"
        animate={{
          background: selectedIndex === 0 
            ? 'linear-gradient(135deg, #FF0050 0%, #00F2EA 100%)'
            : 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
        }}
        transition={{
          duration: 0.6,
          ease: 'easeInOut',
        }}
      />

      {/* Platform Buttons */}
      {platforms.map((platform) => {
        const isSelected = platform.id === selected;
        const Icon = platform.icon;

        return (
          <motion.button
            key={platform.id}
            onClick={() => onSelect(platform.id)}
            className={cn(
              'relative flex items-center gap-3 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300',
              'group overflow-hidden',
              isSelected
                ? 'bg-gradient-to-br text-white shadow-lg'
                : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            style={{
              backgroundImage: isSelected ? `linear-gradient(135deg, ${platform.color.replace('from-', '').replace('to-', '').split(' ').join(', ')})` : undefined,
            }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
            animate={{
              boxShadow: isSelected 
                ? '0 8px 24px -4px rgba(255, 107, 53, 0.4)'
                : '0 2px 8px -2px rgba(0, 0, 0, 0.1)',
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 25,
            }}
          >
            {/* Shimmer Effect on Hover */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              initial={{ x: '-100%', opacity: 0 }}
              whileHover={{ x: '100%', opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            />

            {/* Platform Icon with Animation */}
            <motion.div
              className="relative z-10"
              animate={{
                rotate: isSelected ? [0, -10, 10, 0] : 0,
              }}
              transition={{
                duration: 0.5,
                ease: 'easeInOut',
              }}
            >
              <Icon isActive={isSelected} />
            </motion.div>

            {/* Platform Label */}
            <span className="relative z-10 font-bold tracking-wide">
              {platform.label}
            </span>

            {/* Active Indicator Dot */}
            {isSelected && (
              <motion.div
                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white shadow-lg"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: [0, 1.2, 1],
                  opacity: 1,
                }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

