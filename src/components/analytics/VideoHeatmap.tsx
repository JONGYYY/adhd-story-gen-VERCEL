'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface VideoHeatmapProps {
  videosData: Array<{
    date: string; // YYYY-MM-DD
    count: number; // number of videos posted
  }>;
  title?: string;
  description?: string;
  days?: number; // Number of days to show (default 90)
}

export function VideoHeatmap({ videosData, title = 'Videos Posted Activity', description = 'Daily video posting frequency over time', days = 90 }: VideoHeatmapProps) {
  // Generate calendar grid data (similar to GitHub contribution graph)
  const heatmapData = useMemo(() => {
    // Create a map of date -> count
    const dateMap = new Map<string, number>();
    if (videosData && videosData.length > 0) {
      videosData.forEach(item => {
        dateMap.set(item.date, item.count);
      });
    }

    // Use specified number of days for range
    const maxDate = new Date();
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - days);

    // Adjust to start on Sunday
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Generate all dates in range
    const allDates: Array<{ date: string; count: number; dayOfWeek: number }> = [];
    const current = new Date(startDate);
    
    while (current <= maxDate) {
      const dateStr = current.toISOString().split('T')[0];
      allDates.push({
        date: dateStr,
        count: dateMap.get(dateStr) || 0,
        dayOfWeek: current.getDay()
      });
      current.setDate(current.getDate() + 1);
    }

    // Group by weeks (columns in the heatmap)
    const weeks: Array<Array<{ date: string; count: number; dayOfWeek: number }>> = [];
    let currentWeek: Array<{ date: string; count: number; dayOfWeek: number }> = [];
    
    allDates.forEach((day) => {
      if (day.dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);

    return weeks;
  }, [videosData, days]);

  // Get color intensity based on count
  const getColor = (count: number): string => {
    if (count === 0) return 'bg-muted/30';
    if (count === 1) return 'bg-orange-500/20';
    if (count === 2) return 'bg-orange-500/40';
    if (count === 3) return 'bg-orange-500/60';
    if (count >= 4) return 'bg-orange-500/80';
    return 'bg-muted/30';
  };

  const maxCount = Math.max(...videosData.map(d => d.count), 0);

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-[3px] p-4 bg-muted/20 rounded-xl border border-border/30">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] mr-2 text-[10px] text-muted-foreground font-medium">
            <div className="h-[11px] flex items-center">Sun</div>
            <div className="h-[11px] flex items-center"></div>
            <div className="h-[11px] flex items-center">Tue</div>
            <div className="h-[11px] flex items-center"></div>
            <div className="h-[11px] flex items-center">Thu</div>
            <div className="h-[11px] flex items-center"></div>
            <div className="h-[11px] flex items-center">Sat</div>
          </div>

          {/* Weeks grid */}
          {heatmapData.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((day) => {
                const date = new Date(day.date);
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });
                const dayNum = date.getDate();
                
                return (
                  <div
                    key={day.date}
                    className={cn(
                      'w-[11px] h-[11px] rounded-sm transition-all duration-150 hover:ring-1 hover:ring-orange-500 cursor-pointer border border-border/20',
                      getColor(day.count)
                    )}
                    title={`${monthName} ${dayNum}: ${day.count} video${day.count !== 1 ? 's' : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-6 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-[3px]">
            <div className="w-[11px] h-[11px] rounded-sm bg-muted/30 border border-border/20" />
            <div className="w-[11px] h-[11px] rounded-sm bg-orange-500/20 border border-border/20" />
            <div className="w-[11px] h-[11px] rounded-sm bg-orange-500/40 border border-border/20" />
            <div className="w-[11px] h-[11px] rounded-sm bg-orange-500/60 border border-border/20" />
            <div className="w-[11px] h-[11px] rounded-sm bg-orange-500/80 border border-border/20" />
          </div>
          <span>More</span>
          {maxCount > 0 && (
            <span className="ml-4 text-primary font-medium">Peak: {maxCount} video{maxCount !== 1 ? 's' : ''}/day</span>
          )}
        </div>
      </div>
    </div>
  );
}
