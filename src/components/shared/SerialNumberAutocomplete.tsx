import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SerialNumberAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  itemId?: string;
  placeholder?: string;
}

const SerialNumberAutocomplete = ({ value, onChange, itemId, placeholder = "Type to search..." }: SerialNumberAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<{ serial_number: string; weight_kg: number; length_yards: number | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const search = async () => {
      if (!value || value.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      let query = supabase
        .from('production_records')
        .select('serial_number, weight_kg, length_yards')
        .ilike('serial_number', `%${value}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (itemId) {
        query = query.eq('item_id', itemId);
      }

      const { data, error } = await query;
      setIsLoading(false);

      if (!error && data) {
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [value, itemId]);

  const handleSelect = (suggestion: typeof suggestions[0]) => {
    onChange(suggestion.serial_number);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
      />
      {showSuggestions && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {isLoading ? (
            <div className="p-2 text-sm text-muted-foreground">Searching...</div>
          ) : (
            suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  "border-b last:border-b-0 border-border"
                )}
                onClick={() => handleSelect(s)}
              >
                <div className="font-mono text-xs">{s.serial_number}</div>
                <div className="text-xs text-muted-foreground">
                  {s.weight_kg}kg{s.length_yards ? ` · ${s.length_yards} yds` : ''}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SerialNumberAutocomplete;
