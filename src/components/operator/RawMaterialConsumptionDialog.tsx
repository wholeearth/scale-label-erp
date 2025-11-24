import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ConsumptionEntry {
  serialNumber: string;
  weight?: number;
  length?: number;
}

interface RawMaterialConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entries: ConsumptionEntry[]) => void;
  requiresWeight: boolean;
  requiresLength: boolean;
}

const RawMaterialConsumptionDialog = ({
  open,
  onOpenChange,
  onSubmit,
  requiresWeight,
  requiresLength,
}: RawMaterialConsumptionDialogProps) => {
  const [entries, setEntries] = useState<ConsumptionEntry[]>([
    { serialNumber: '', weight: undefined, length: undefined },
  ]);

  const addEntry = () => {
    setEntries([...entries, { serialNumber: '', weight: undefined, length: undefined }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const updateEntry = (index: number, field: keyof ConsumptionEntry, value: string | number) => {
    const newEntries = [...entries];
    if (field === 'serialNumber') {
      newEntries[index][field] = value as string;
    } else {
      newEntries[index][field] = value ? parseFloat(value as string) : undefined;
    }
    setEntries(newEntries);
  };

  const handleSubmit = () => {
    // Validate all entries
    const validEntries = entries.filter(entry => {
      if (!entry.serialNumber.trim()) return false;
      if (requiresWeight && !entry.weight) return false;
      if (requiresLength && !entry.length) return false;
      return true;
    });

    if (validEntries.length === 0) {
      return;
    }

    onSubmit(validEntries);
    setEntries([{ serialNumber: '', weight: undefined, length: undefined }]);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setEntries([{ serialNumber: '', weight: undefined, length: undefined }]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raw Material Consumption</DialogTitle>
          <DialogDescription>
            Enter the serial numbers of source jumbo rolls and consumption amounts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {entries.map((entry, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Entry {index + 1}</Label>
                  {entries.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEntry(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div>
                  <Label htmlFor={`serial-${index}`}>Serial Number *</Label>
                  <Input
                    id={`serial-${index}`}
                    placeholder="e.g., 01-M1-041025-00152-0119"
                    value={entry.serialNumber}
                    onChange={(e) => updateEntry(index, 'serialNumber', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {requiresWeight && (
                    <div>
                      <Label htmlFor={`weight-${index}`}>Weight Consumed (kg) *</Label>
                      <Input
                        id={`weight-${index}`}
                        type="number"
                        step="0.01"
                        placeholder="e.g., 15.5"
                        value={entry.weight || ''}
                        onChange={(e) => updateEntry(index, 'weight', e.target.value)}
                      />
                    </div>
                  )}

                  {requiresLength && (
                    <div>
                      <Label htmlFor={`length-${index}`}>Length Consumed (yards) *</Label>
                      <Input
                        id={`length-${index}`}
                        type="number"
                        step="0.01"
                        placeholder="e.g., 100"
                        value={entry.length || ''}
                        onChange={(e) => updateEntry(index, 'length', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}

          <Button type="button" variant="outline" onClick={addEntry} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Source Roll
          </Button>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit}>
              Confirm Consumption
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RawMaterialConsumptionDialog;