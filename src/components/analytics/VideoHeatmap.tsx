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
}

export function VideoHeatmap({ videosData, title = 'Videos Posted Activity', description = 'Daily video posting frequency over time' }: VideoHeatmapProps) {
  // Generate calendar grid data (similar to GitHub contribution graph)
  const heatmapData = useMemo(() => {
    if (!videosData || videosData.length === 0) return [];

    // Create a map of date -> count
    const dateMap = new Map<string, number>();
    videosData.forEach(item => {
      dateMap.set(item.date, item.count);
    });

    // Get date range
    const dates = videosData.map(d => new Date(d.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

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

    // Group by weeks
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
  }, [videosData]);

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
      <div className="overflow-x-auto">
        <div className="inline-flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 mr-2 justify-around text-xs text-muted-foreground">
            <div className="h-3">Mon</div>
            <div className="h-3">Wed</div>
            <div className="h-3">Fri</div>
          </div>

          {/* Weeks grid */}
          {heatmapData.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((day, dayIndex) => {
                const date = new Date(day.date);
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });
                const dayNum = date.getDate();
                
                return (
                  <div
                    key={day.date}
                    className={cn(
                      'w-3 h-3 rounded-sm transition-all duration-200 hover:ring-2 hover:ring-orange-500/50 cursor-pointer',
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
        <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-muted/30" />
            <div className="w-3 h-3 rounded-sm bg-orange-500/20" />
            <div className="w-3 h-3 rounded-sm bg-orange-500/40" />
            <div className="w-3 h-3 rounded-sm bg-orange-500/60" />
            <div className="w-3 h-3 rounded-sm bg-orange-500/80" />
          </div>
          <span>More</span>
          <span className="ml-4">Peak: {maxCount} video{maxCount !== 1 ? 's' : ''}/day</span>
        </div>
      </div>
    </div>
  );
}
