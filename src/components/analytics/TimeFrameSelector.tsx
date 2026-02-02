'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Calendar, Clock } from 'lucide-react';

export type TimeFrame = '7d' | '30d' | '90d' | 'all';

interface TimeFrameSelectorProps {
  selected: TimeFrame;
  onSelect: (timeFrame: TimeFrame) => void;
  className?: string;
}

const timeFrames: Array<{ id: TimeFrame; label: string; description: string }> = [
  { id: '7d', label: '7D', description: 'Last 7 days' },
  { id: '30d', label: '30D', description: 'Last 30 days' },
  { id: '90d', label: '90D', description: 'Last 90 days' },
  { id: 'all', label: 'All', description: 'All time' },
];

export function TimeFrameSelector({ selected, onSelect, className }: TimeFrameSelectorProps) {
  const selectedIndex = timeFrames.findIndex(tf => tf.id === selected);

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      {/* Label with Icon */}
      <motion.div 
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Clock className="w-4 h-4" />
        <span>Time Range:</span>
      </motion.div>

      {/* Time Frame Buttons */}
      <div className="relative inline-flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/50 backdrop-blur-sm">
        {/* Animated Background Slider */}
        <motion.div
          className="absolute top-1 h-[calc(100%-8px)] rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 shadow-sm"
          initial={false}
          animate={{
            x: `calc(${selectedIndex * 100}% + ${selectedIndex * 4}px + 4px)`,
            width: 'calc(25% - 8px)',
          }}
          transition={{
            type: 'spring',
            stiffness: 350,
            damping: 30,
          }}
        />

        {/* Buttons */}
        {timeFrames.map((timeFrame, index) => {
          const isSelected = timeFrame.id === selected;

          return (
            <motion.button
              key={timeFrame.id}
              onClick={() => onSelect(timeFrame.id)}
              className={cn(
                'relative z-10 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200',
                'group min-w-[60px]',
                isSelected
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={timeFrame.description}
            >
              {/* Label */}
              <motion.span
                animate={{
                  scale: isSelected ? [1, 1.1, 1] : 1,
                }}
                transition={{
                  duration: 0.3,
                  ease: 'easeInOut',
                }}
              >
                {timeFrame.label}
              </motion.span>

              {/* Hover Tooltip */}
              <motion.div
                className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-background border border-border shadow-lg text-xs font-medium whitespace-nowrap pointer-events-none"
                initial={{ opacity: 0, y: -5, scale: 0.9 }}
                whileHover={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {timeFrame.description}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-background border-l border-t border-border rotate-45" />
              </motion.div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

