import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SerialNumberAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (data: {
    serial_number: string;
    weight_kg: number;
    length_yards: number | null;
    source?: 'production' | 'fiber_bag';
  }) => void;
  itemId?: string;
  placeholder?: string;
}

interface Suggestion {
  serial_number: string;
  weight_kg: number;
  length_yards: number | null;
  source: 'production' | 'fiber_bag';
  label?: string;
}

// Strip hyphens for comparison so users can search with or without hyphens
const normalize = (s: string) => (s || '').replace(/-/g, '').toUpperCase();

const SerialNumberAutocomplete = ({
  value,
  onChange,
  onSelect,
  itemId,
  placeholder = 'Type or scan serial...',
}: SerialNumberAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
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
      const term = value.trim();
      const normTerm = normalize(term);

      // ---- Production records (existing flow) ----
      let prodQuery = supabase
        .from('production_records')
        .select('serial_number, weight_kg, length_yards')
        .ilike('serial_number', `%${term}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (itemId) prodQuery = prodQuery.eq('item_id', itemId);

      // ---- Fiber bags (search unique_id; hyphens irrelevant since DB stores no hyphens) ----
      let bagQuery = supabase
        .from('fiber_bags')
        .select('unique_id, original_weight_kg, consumed_weight_kg, status, supplier_name, pack_type, item_id')
        .ilike('unique_id', `%${normTerm}%`)
        .neq('status', 'used')
        .order('created_at', { ascending: false })
        .limit(20);
      if (itemId) bagQuery = bagQuery.eq('item_id', itemId);

      const [prodResult, consumptionResult, bagResult] = await Promise.all([
        prodQuery,
        supabase
          .from('shift_raw_material_consumption')
          .select('consumed_serial_number, consumed_weight_kg, consumed_length_yards')
          .ilike('consumed_serial_number', `%${term}%`),
        bagQuery,
      ]);

      setIsLoading(false);

      // ---- Production: aggregate consumed and compute remaining ----
      const consumed: Record<string, { weight: number; length: number }> = {};
      if (consumptionResult.data) {
        for (const c of consumptionResult.data) {
          const sn = c.consumed_serial_number || '';
          if (!consumed[sn]) consumed[sn] = { weight: 0, length: 0 };
          consumed[sn].weight += c.consumed_weight_kg || 0;
          consumed[sn].length += c.consumed_length_yards || 0;
        }
      }

      const productionSuggestions: Suggestion[] = (prodResult.data || [])
        .map((p) => {
          const c = consumed[p.serial_number] || { weight: 0, length: 0 };
          return {
            serial_number: p.serial_number,
            weight_kg: Math.max(0, (p.weight_kg || 0) - c.weight),
            length_yards:
              p.length_yards != null ? Math.max(0, (p.length_yards || 0) - c.length) : null,
            source: 'production' as const,
          };
        })
        .filter(
          (p) => p.weight_kg > 0.01 || (p.length_yards != null && p.length_yards > 0.01),
        );

      // ---- Fiber bags: remaining = original - consumed ----
      const bagSuggestions: Suggestion[] = (bagResult.data || []).map((b) => ({
        serial_number: b.unique_id,
        weight_kg: Math.max(0, (b.original_weight_kg || 0) - (b.consumed_weight_kg || 0)),
        length_yards: null,
        source: 'fiber_bag' as const,
        label: `${b.pack_type === 'bale' ? 'Bale' : 'Bag'} · ${b.supplier_name}`,
      }));

      const merged = [...bagSuggestions, ...productionSuggestions];
      setSuggestions(merged);
      setShowSuggestions(merged.length > 0);
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [value, itemId]);

  const handleSelect = (s: Suggestion) => {
    onChange(s.serial_number);
    onSelect?.(s);
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
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {isLoading ? (
            <div className="p-2 text-sm text-muted-foreground">Searching...</div>
          ) : (
            suggestions.map((s, i) => (
              <button
                key={`${s.source}-${s.serial_number}-${i}`}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer',
                  'border-b last:border-b-0 border-border',
                )}
                onClick={() => handleSelect(s)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs truncate">{s.serial_number}</div>
                  <Badge variant={s.source === 'fiber_bag' ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                    {s.source === 'fiber_bag' ? 'Fiber Bag' : 'Production'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Remaining: {s.weight_kg.toFixed(2)}kg
                  {s.length_yards != null ? ` · ${s.length_yards.toFixed(2)} yds` : ''}
                  {s.label ? ` · ${s.label}` : ''}
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
