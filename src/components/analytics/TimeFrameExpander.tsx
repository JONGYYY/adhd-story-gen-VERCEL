'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TimeFrameOption = 'today' | '1week' | '1month' | '1year';

interface TimeFrameExpanderProps {
  selected: TimeFrameOption;
  onSelect: (option: TimeFrameOption) => void;
}

const timeFrameOptions: { value: TimeFrameOption; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '1week', label: '1 Week' },
  { value: '1month', label: '1 Month' },
  { value: '1year', label: '1 Year' },
];

export function TimeFrameExpander({ selected, onSelect }: TimeFrameExpanderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const selectedOption = timeFrameOptions.find(opt => opt.value === selected);

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-200',
          'bg-background hover:bg-muted/50',
          isExpanded 
            ? 'border-primary shadow-lg shadow-primary/10' 
            : 'border-border hover:border-border/80'
        )}
      >
        <Calendar className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">{selectedOption?.label || 'Select'}</span>
        <ChevronDown 
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-180'
          )} 
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsExpanded(false)}
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-2 w-full min-w-[180px] rounded-xl border-2 border-border bg-background shadow-2xl z-50 overflow-hidden"
            >
              {timeFrameOptions.map((option, index) => (
                <motion.button
                  key={option.value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    onSelect(option.value);
                    setIsExpanded(false);
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left text-sm font-medium transition-colors',
                    'hover:bg-muted/80 border-b border-border/50 last:border-b-0',
                    option.value === selected 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-foreground'
                  )}
                >
                  {option.label}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
