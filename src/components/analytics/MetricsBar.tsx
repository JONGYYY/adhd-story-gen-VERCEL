'use client';

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Line } from 'react-chartjs-2';

interface MetricSection {
  title: string;
  value: string;
  icon: LucideIcon;
  growth: number;
  data: number[];
  color: string;
  isSelected?: boolean;
  onClick?: () => void;
  showGraph?: boolean;
}

interface MetricsBarProps {
  metrics: MetricSection[];
}

export function MetricsBar({ metrics }: MetricsBarProps) {
  return (
    <div className="card-elevo flex flex-row overflow-hidden">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        const isPositive = metric.growth >= 0;
        const isLast = index === metrics.length - 1;
        
        // Chart config for mini sparkline
        const chartData = {
          labels: metric.data.map((_, i) => i.toString()),
          datasets: [{
            data: metric.data,
            borderColor: metric.color,
            backgroundColor: `${metric.color}20`,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 0,
          }]
        };

        const chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          scales: {
            x: { display: false },
            y: { display: false },
          },
          interaction: { mode: 'none' as const },
        };

        return (
          <div
            key={metric.title}
            onClick={metric.onClick}
            className={cn(
              'flex-1 p-6 transition-all duration-200',
              !isLast && 'border-r border-border/50',
              metric.onClick && 'cursor-pointer hover:bg-muted/20',
              metric.isSelected && 'bg-primary/5 ring-2 ring-primary/50 ring-inset'
            )}
          >
            {/* Growth Badge (Top Right) */}
            {metric.growth !== undefined && (
              <div className="flex justify-end mb-2">
                <div
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold',
                    isPositive
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  )}
                >
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(metric.growth).toFixed(1)}%
                </div>
              </div>
            )}

            {/* Title with Icon */}
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4" style={{ color: metric.color }} />
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{metric.title}</p>
            </div>

            {/* Value and Sparkline */}
            <div className="flex items-end justify-between gap-4">
              <div className="flex-shrink-0">
                <p className="text-2xl font-bold tracking-tight">{metric.value}</p>
              </div>

              {/* Sparkline Graph (only if showGraph is true) */}
              {metric.showGraph !== false && (
                <div className="flex-1 h-12 max-w-[120px]">
                  <Line data={chartData} options={chartOptions} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
