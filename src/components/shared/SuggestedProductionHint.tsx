import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  itemId: string | null;
  orderQty: number;
  onApply?: (suggestedQty: number) => void;
}

/**
 * Small inline hint that shows surplus stock for an item
 * and a one-click apply for the suggested production quantity.
 */
export const SuggestedProductionHint = ({ itemId, orderQty, onApply }: Props) => {
  const [data, setData] = useState<{ surplus_available: number; suggested_qty: number } | null>(null);

  useEffect(() => {
    if (!itemId || !orderQty || orderQty <= 0) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: res, error } = await supabase.rpc('get_suggested_production', {
        _item_id: itemId,
        _order_qty: orderQty,
      });
      if (cancelled || error) return;
      setData(res as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, orderQty]);

  if (!data || Number(data.surplus_available) <= 0) return null;

  return (
    <div className="flex items-start gap-2 p-3 rounded-md border border-primary/20 bg-primary/5 text-sm">
      <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
      <div className="flex-1">
        <p>
          <span className="font-medium">{Number(data.surplus_available)}</span> surplus units in stock for this item.
        </p>
        <p className="text-muted-foreground">
          Suggested production: <span className="font-medium text-foreground">{Number(data.suggested_qty)}</span> (Order {orderQty} − Surplus {Number(data.surplus_available)})
        </p>
      </div>
      {onApply && (
        <Button size="sm" variant="outline" onClick={() => onApply(Number(data.suggested_qty))}>
          Apply
        </Button>
      )}
    </div>
  );
};

export default SuggestedProductionHint;
