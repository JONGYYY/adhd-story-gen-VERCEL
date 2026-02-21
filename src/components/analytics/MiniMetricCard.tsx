'use client';

import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { cn } from '@/lib/utils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler);

interface MiniMetricCardProps {
  title: string;
  value: string | number;
  data: number[];
  growth: number;
  isSelected?: boolean;
  onClick?: () => void;
  color?: string;
  icon?: LucideIcon;
}

export function MiniMetricCard({
  title,
  value,
  data,
  growth,
  isSelected = false,
  onClick,
  color = '#FF7847',
  icon: Icon,
}: MiniMetricCardProps) {
  const isPositive = growth >= 0;

  const chartData = {
    labels: data.map((_, i) => i.toString()),
    datasets: [
      {
        data: data,
        fill: true,
        borderColor: color,
        backgroundColor: `${color}20`,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  };

  const chartOptions: any = {
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
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'card-elevo p-6 transition-all duration-300 cursor-pointer group relative min-w-[220px] flex-1',
        'hover:scale-[1.02] hover:shadow-xl',
        isSelected && 'ring-2 ring-primary shadow-xl shadow-primary/20'
      )}
    >
      {/* Growth Indicator (Top Right) */}
      <div className="absolute top-4 right-4">
        <div
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold',
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
          {Math.abs(growth).toFixed(1)}%
        </div>
      </div>

      {/* Title with Icon */}
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-4 h-4" style={{ color }} />}
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
      </div>

      <div className="flex items-end justify-between gap-4">
        {/* Value (Bottom Left) */}
        <div className="flex-shrink-0">
          <p className="text-3xl font-bold tracking-tight">{value}</p>
        </div>

        {/* Sparkline Graph (Center-Right) */}
        <div className="flex-1 h-16 min-w-[100px] max-w-[150px]">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
