import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus } from 'lucide-react';

export interface PackingRow {
  bag_serial: number;
  pack_type: 'bag' | 'bale';
  weight_kg: string;
}

interface Props {
  rows: PackingRow[];
  onChange: (rows: PackingRow[]) => void;
}

const FiberPackingListEntry = ({ rows, onChange }: Props) => {
  const addRow = () => {
    const nextSerial = rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.bag_serial)) + 1;
    const lastType = rows.length > 0 ? rows[rows.length - 1].pack_type : 'bag';
    onChange([...rows, { bag_serial: nextSerial, pack_type: lastType, weight_kg: '' }]);
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof PackingRow, value: string) => {
    const next = [...rows];
    if (field === 'bag_serial') next[idx].bag_serial = parseInt(value) || 0;
    else if (field === 'pack_type') next[idx].pack_type = value as 'bag' | 'bale';
    else next[idx].weight_kg = value;
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number, field: keyof PackingRow) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (idx === rows.length - 1 && field === 'weight_kg') {
        addRow();
        // focus next row's weight input after render
        setTimeout(() => {
          const inputs = document.querySelectorAll<HTMLInputElement>(
            'input[data-packing-weight]'
          );
          inputs[inputs.length - 1]?.focus();
        }, 0);
      }
    }
  };

  const totalWeight = rows.reduce((sum, r) => sum + (parseFloat(r.weight_kg) || 0), 0);

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Packing List</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Bags: {rows.length}</span>
          <span className="font-semibold">Total: {totalWeight.toFixed(3)} kg</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="w-20 p-1 text-left">Serial #</th>
              <th className="w-28 p-1 text-left">Type</th>
              <th className="p-1 text-right">Weight (kg)</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="p-1">
                  <Input
                    type="number"
                    min={1}
                    value={row.bag_serial}
                    onChange={(e) => updateRow(idx, 'bag_serial', e.target.value)}
                    className="h-8"
                  />
                </td>
                <td className="p-1">
                  <Select
                    value={row.pack_type}
                    onValueChange={(v) => updateRow(idx, 'pack_type', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bag">Bag</SelectItem>
                      <SelectItem value="bale">Bale</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={row.weight_kg}
                    onChange={(e) => updateRow(idx, 'weight_kg', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, idx, 'weight_kg')}
                    placeholder="0.000"
                    className="h-8 text-right"
                    data-packing-weight
                  />
                </td>
                <td className="p-1 text-center">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-destructive hover:opacity-80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        className="w-full"
      >
        <Plus className="mr-1 h-3 w-3" /> Add Bag/Bale Row (Enter)
      </Button>
    </div>
  );
};

export default FiberPackingListEntry;
