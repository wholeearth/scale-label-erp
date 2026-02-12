import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface InventorySerialDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  productName: string;
  productCode: string;
}

interface SerialDetail {
  serial_number: string;
  original_weight: number;
  original_length: number | null;
  remaining_weight: number;
  remaining_length: number | null;
  production_date: string;
}

const InventorySerialDetails = ({ open, onOpenChange, itemId, productName, productCode }: InventorySerialDetailsProps) => {
  const { data: serialDetails, isLoading } = useQuery({
    queryKey: ['inventory-serial-details', itemId],
    enabled: open && !!itemId,
    queryFn: async () => {
      // Fetch all production records for this item
      const { data: records, error: recError } = await supabase
        .from('production_records')
        .select('serial_number, weight_kg, length_yards, production_date')
        .eq('item_id', itemId)
        .order('production_date', { ascending: false });

      if (recError) throw recError;
      if (!records || records.length === 0) return [];

      // Fetch all consumption for these serial numbers
      const serialNumbers = records.map(r => r.serial_number);
      const { data: consumption } = await supabase
        .from('shift_raw_material_consumption')
        .select('consumed_serial_number, consumed_weight_kg, consumed_length_yards')
        .in('consumed_serial_number', serialNumbers);

      // Aggregate consumption
      const consumed: Record<string, { weight: number; length: number }> = {};
      if (consumption) {
        for (const c of consumption) {
          const sn = c.consumed_serial_number || '';
          if (!consumed[sn]) consumed[sn] = { weight: 0, length: 0 };
          consumed[sn].weight += c.consumed_weight_kg || 0;
          consumed[sn].length += c.consumed_length_yards || 0;
        }
      }

      // Calculate remaining
      const details: SerialDetail[] = records.map(r => {
        const c = consumed[r.serial_number] || { weight: 0, length: 0 };
        return {
          serial_number: r.serial_number,
          original_weight: r.weight_kg || 0,
          original_length: r.length_yards,
          remaining_weight: Math.max(0, (r.weight_kg || 0) - c.weight),
          remaining_length: r.length_yards != null ? Math.max(0, (r.length_yards || 0) - c.length) : null,
          production_date: r.production_date,
        };
      });

      // Filter out fully consumed
      return details.filter(d => d.remaining_weight > 0.01 || (d.remaining_length != null && d.remaining_length > 0.01));
    },
  });

  const totalRemainingWeight = serialDetails?.reduce((s, d) => s + d.remaining_weight, 0) || 0;
  const totalRemainingLength = serialDetails?.reduce((s, d) => s + (d.remaining_length || 0), 0) || 0;
  const hasLength = serialDetails?.some(d => d.remaining_length != null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{productCode} – {productName}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mb-4">
          <Badge variant="outline" className="text-sm px-3 py-1">
            {serialDetails?.length || 0} Serial No(s)
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            Total Weight: {totalRemainingWeight.toFixed(2)} kg
          </Badge>
          {hasLength && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              Total Length: {totalRemainingLength.toFixed(2)} yds
            </Badge>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serial Number</TableHead>
              <TableHead className="text-right">Original Weight (kg)</TableHead>
              <TableHead className="text-right">Remaining Weight (kg)</TableHead>
              {hasLength && <TableHead className="text-right">Original Length (yds)</TableHead>}
              {hasLength && <TableHead className="text-right">Remaining Length (yds)</TableHead>}
              <TableHead className="text-right">Production Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={hasLength ? 6 : 4} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : serialDetails?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hasLength ? 6 : 4} className="text-center">No serial numbers in stock</TableCell>
              </TableRow>
            ) : (
              serialDetails?.map((d) => (
                <TableRow key={d.serial_number}>
                  <TableCell className="font-mono text-xs">{d.serial_number}</TableCell>
                  <TableCell className="text-right">{d.original_weight.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={d.remaining_weight < 1 ? 'destructive' : 'default'}>
                      {d.remaining_weight.toFixed(2)}
                    </Badge>
                  </TableCell>
                  {hasLength && <TableCell className="text-right">{d.original_length?.toFixed(2) ?? '-'}</TableCell>}
                  {hasLength && (
                    <TableCell className="text-right">
                      <Badge variant={d.remaining_length != null && d.remaining_length < 1 ? 'destructive' : 'default'}>
                        {d.remaining_length?.toFixed(2) ?? '-'}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-right">{new Date(d.production_date).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};

export default InventorySerialDetails;
