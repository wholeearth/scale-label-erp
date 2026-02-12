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
      
      // Query production records
      let query = supabase
        .from('production_records')
        .select('serial_number, weight_kg, length_yards')
        .ilike('serial_number', `%${value}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (itemId) {
        query = query.eq('item_id', itemId);
      }

      const [prodResult, consumptionResult] = await Promise.all([
        query,
        supabase
          .from('shift_raw_material_consumption')
          .select('consumed_serial_number, consumed_weight_kg, consumed_length_yards')
          .ilike('consumed_serial_number', `%${value}%`)
      ]);

      setIsLoading(false);

      if (prodResult.error || !prodResult.data) return;

      // Aggregate total consumed per serial number
      const consumed: Record<string, { weight: number; length: number }> = {};
      if (consumptionResult.data) {
        for (const c of consumptionResult.data) {
          const sn = c.consumed_serial_number || '';
          if (!consumed[sn]) consumed[sn] = { weight: 0, length: 0 };
          consumed[sn].weight += c.consumed_weight_kg || 0;
          consumed[sn].length += c.consumed_length_yards || 0;
        }
      }

      // Calculate remaining and filter out fully consumed
      const withRemaining = prodResult.data
        .map(p => {
          const c = consumed[p.serial_number] || { weight: 0, length: 0 };
          return {
            serial_number: p.serial_number,
            weight_kg: Math.max(0, (p.weight_kg || 0) - c.weight),
            length_yards: p.length_yards != null ? Math.max(0, (p.length_yards || 0) - c.length) : null,
          };
        })
        .filter(p => p.weight_kg > 0.01 || (p.length_yards != null && p.length_yards > 0.01));

      setSuggestions(withRemaining);
      setShowSuggestions(withRemaining.length > 0);
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
                  Remaining: {s.weight_kg.toFixed(2)}kg{s.length_yards != null ? ` · ${s.length_yards.toFixed(2)} yds` : ''}
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
