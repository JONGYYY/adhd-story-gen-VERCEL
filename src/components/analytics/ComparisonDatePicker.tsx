'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ComparisonDatePickerProps {
  startDate?: string;
  endDate?: string;
  onDatesChange: (startDate: string, endDate: string) => void;
  onClear: () => void;
}

export function ComparisonDatePicker({ startDate, endDate, onDatesChange, onClear }: ComparisonDatePickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate || '');
  const [tempEndDate, setTempEndDate] = useState(endDate || '');

  const handleApply = () => {
    if (tempStartDate && tempEndDate) {
      onDatesChange(tempStartDate, tempEndDate);
      setIsExpanded(false);
    }
  };

  const formatDateLabel = () => {
    if (startDate && endDate) {
      return `Compare to ${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return 'Compare to period';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-200',
          'bg-background hover:bg-muted/50',
          isExpanded || (startDate && endDate)
            ? 'border-primary shadow-lg shadow-primary/10' 
            : 'border-border hover:border-border/80'
        )}
      >
        <Calendar className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">{formatDateLabel()}</span>
        {startDate && endDate ? (
          <X 
            className="w-4 h-4 text-muted-foreground hover:text-foreground" 
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              setTempStartDate('');
              setTempEndDate('');
            }}
          />
        ) : (
          <ChevronDown 
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-180'
            )} 
          />
        )}
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
              className="absolute top-full left-0 mt-2 w-[320px] rounded-xl border-2 border-border bg-background shadow-2xl z-50 p-4"
            >
              <h3 className="text-sm font-semibold mb-3">Comparison Period</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border-2 border-border bg-background text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">End Date</label>
                  <input
                    type="date"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border-2 border-border bg-background text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleApply}
                    disabled={!tempStartDate || !tempEndDate}
                    className="flex-1 bg-primary hover:bg-primary/90"
                    size="sm"
                  >
                    Apply
                  </Button>
                  <Button
                    onClick={() => setIsExpanded(false)}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
