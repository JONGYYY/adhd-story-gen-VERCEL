'use client';

import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface RedditUrlInputProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxUrls?: number;
}

export function RedditUrlInput({ value, onChange, maxUrls = 50 }: RedditUrlInputProps) {
  const [rawText, setRawText] = useState(value.join('\n'));
  const [validation, setValidation] = useState({ valid: 0, invalid: 0, duplicates: 0 });
  
  useEffect(() => {
    // Parse and validate URLs
    const lines = rawText.split('\n').filter(line => line.trim());
    const urls = new Set<string>();
    let invalidCount = 0;
    let duplicateCount = 0;
    
    const validUrls: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Validate Reddit URL format
      if (!/^https?:\/\/(www\.)?reddit\.com\/r\/\w+\/comments\//.test(trimmed)) {
        invalidCount++;
        continue;
      }
      
      // Check for duplicates
      if (urls.has(trimmed)) {
        duplicateCount++;
        continue;
      }
      
      urls.add(trimmed);
      validUrls.push(trimmed);
    }
    
    setValidation({
      valid: validUrls.length,
      invalid: invalidCount,
      duplicates: duplicateCount
    });
    
    onChange(validUrls.slice(0, maxUrls));
  }, [rawText, maxUrls, onChange]);
  
  return (
    <div className="space-y-3">
      <Textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="https://reddit.com/r/AITA/comments/abc123/...&#10;https://reddit.com/r/nosleep/comments/xyz789/...&#10;(One URL per line)"
        rows={10}
        className="font-mono text-sm"
      />
      
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className={validation.valid > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
            <CheckCircle2 className="inline w-4 h-4 mr-1" />
            {validation.valid}/{maxUrls} valid URLs
          </span>
          
          {validation.invalid > 0 && (
            <span className="text-red-600 dark:text-red-400">
              <AlertCircle className="inline w-4 h-4 mr-1" />
              {validation.invalid} invalid
            </span>
          )}
          
          {validation.duplicates > 0 && (
            <span className="text-yellow-600 dark:text-yellow-400">
              {validation.duplicates} duplicates removed
            </span>
          )}
        </div>
      </div>
      
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          One URL will be used per scheduled post. Campaign stops automatically when all URLs are used.
        </AlertDescription>
      </Alert>
    </div>
  );
}
