'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, X } from 'lucide-react';
import { calculateDistributedTimes, calculateNextRunTime } from '@/lib/campaigns/db';
import { CampaignFrequency } from '@/lib/campaigns/types';

interface ScheduleConfig {
  frequency: CampaignFrequency;
  scheduleTime?: string;
  intervalHours?: number;
  timesPerDay?: number;
  customScheduleTimes?: string[];
}

interface AdvancedSchedulerProps {
  value: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
}

export function AdvancedScheduler({ value, onChange }: AdvancedSchedulerProps) {
  const [newTime, setNewTime] = useState('09:00');
  
  // Calculate preview of next runs
  const getNextRuns = () => {
    const times: string[] = [];
    let nextRunAt = Date.now();
    
    try {
      for (let i = 0; i < 3; i++) {
        nextRunAt = calculateNextRunTime(
          value.frequency,
          value.scheduleTime || '09:00',
          value.customScheduleTimes,
          value.intervalHours,
          value.timesPerDay,
          value.frequency === 'times-per-day' ? calculateDistributedTimes(value.timesPerDay || 1) : undefined,
          nextRunAt
        );
        
        const date = new Date(nextRunAt);
        times.push(date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }));
      }
    } catch (error) {
      console.error('Error calculating next runs:', error);
      return ['Error calculating schedule'];
    }
    
    return times;
  };
  
  return (
    <div className="space-y-4">
      <RadioGroup
        value={value.frequency}
        onValueChange={(freq) => onChange({ ...value, frequency: freq as CampaignFrequency })}
      >
        {/* Daily */}
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="daily" id="daily" />
          <Label htmlFor="daily" className="font-normal cursor-pointer">
            Daily (Once per day)
          </Label>
        </div>
        
        {value.frequency === 'daily' && (
          <div className="ml-6 mt-2">
            <Input
              type="time"
              value={value.scheduleTime || '09:00'}
              onChange={(e) => onChange({ ...value, scheduleTime: e.target.value })}
              className="w-32"
            />
          </div>
        )}
        
        {/* Interval */}
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="interval" id="interval" />
          <Label htmlFor="interval" className="font-normal cursor-pointer">
            Interval (Every X hours)
          </Label>
        </div>
        
        {value.frequency === 'interval' && (
          <div className="ml-6 mt-2 flex items-center gap-2">
            <span className="text-sm">Every</span>
            <Input
              type="number"
              min={1}
              max={24}
              value={value.intervalHours || 4}
              onChange={(e) => onChange({ ...value, intervalHours: parseInt(e.target.value) || 4 })}
              className="w-20"
            />
            <span className="text-sm">hours</span>
          </div>
        )}
        
        {/* Times per day */}
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="times-per-day" id="times-per-day" />
          <Label htmlFor="times-per-day" className="font-normal cursor-pointer">
            Multiple Times Daily
          </Label>
        </div>
        
        {value.frequency === 'times-per-day' && (
          <div className="ml-6 mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={2}
                max={12}
                value={value.timesPerDay || 3}
                onChange={(e) => onChange({ ...value, timesPerDay: parseInt(e.target.value) || 3 })}
                className="w-20"
              />
              <span className="text-sm">times per day (evenly distributed)</span>
            </div>
            
            {value.timesPerDay && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Times: {calculateDistributedTimes(value.timesPerDay).map(t => {
                  const [h, m] = t.split(':');
                  const hour = parseInt(h);
                  const ampm = hour >= 12 ? 'PM' : 'AM';
                  const hour12 = hour % 12 || 12;
                  return `${hour12}:${m} ${ampm}`;
                }).join(', ')}
              </div>
            )}
          </div>
        )}
        
        {/* Custom */}
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="custom" id="custom" />
          <Label htmlFor="custom" className="font-normal cursor-pointer">
            Custom Schedule (Specific times)
          </Label>
        </div>
        
        {value.frequency === 'custom' && (
          <div className="ml-6 mt-2 space-y-2">
            <div className="flex gap-2">
              <Input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-32"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const times = value.customScheduleTimes || [];
                  if (!times.includes(newTime)) {
                    onChange({ ...value, customScheduleTimes: [...times, newTime].sort() });
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            
            {value.customScheduleTimes && value.customScheduleTimes.length > 0 && (
              <div className="space-y-1">
                {value.customScheduleTimes.map(time => (
                  <div key={time} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <span className="text-sm">{time}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onChange({
                          ...value,
                          customScheduleTimes: value.customScheduleTimes?.filter(t => t !== time)
                        });
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Twice daily (existing option) */}
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="twice-daily" id="twice-daily" />
          <Label htmlFor="twice-daily" className="font-normal cursor-pointer">
            Twice Daily (12 hours apart)
          </Label>
        </div>
        
        {value.frequency === 'twice-daily' && (
          <div className="ml-6 mt-2">
            <Input
              type="time"
              value={value.scheduleTime || '09:00'}
              onChange={(e) => onChange({ ...value, scheduleTime: e.target.value })}
              className="w-32"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              First run at {value.scheduleTime || '09:00'}, second run 12 hours later
            </p>
          </div>
        )}
      </RadioGroup>
      
      {/* Preview */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          <Calendar className="w-4 h-4" />
          Preview: Next 3 runs
        </div>
        <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
          {getNextRuns().map((time, i) => (
            <div key={i}>• {time}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
