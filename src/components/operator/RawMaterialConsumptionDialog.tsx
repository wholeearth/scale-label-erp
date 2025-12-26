import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface ConsumptionEntry {
  serialNumber: string;
  weight?: number;
  length?: number;
  validationStatus?: 'pending' | 'valid' | 'invalid';
  validationMessage?: string;
}

interface AvailableSerial {
  serial_number: string;
  product_name: string;
  product_code: string;
  item_type: string;
  weight_kg: number;
  length_yards: number | null;
}

interface RawMaterialConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entries: ConsumptionEntry[]) => void;
  requiresWeight: boolean;
  requiresLength: boolean;
  producingItemType?: string;
}

const RawMaterialConsumptionDialog = ({
  open,
  onOpenChange,
  onSubmit,
  requiresWeight,
  requiresLength,
  producingItemType,
}: RawMaterialConsumptionDialogProps) => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ConsumptionEntry[]>([
    { serialNumber: '', weight: undefined, length: undefined, validationStatus: 'pending' },
  ]);

  // Determine which item types are allowed based on what we're producing
  const getAllowedItemTypes = (): string[] => {
    if (producingItemType === 'intermediate_type_1') {
      return ['raw_material'];
    }
    if (producingItemType === 'intermediate_type_2') {
      return ['raw_material', 'intermediate_type_1'];
    }
    // For finished goods, allow intermediate products
    return ['raw_material', 'intermediate_type_1', 'intermediate_type_2'];
  };

  // Fetch available serial numbers based on allowed item types
  const { data: availableSerials, isLoading: isLoadingSerials } = useQuery({
    queryKey: ['available-serials', producingItemType],
    queryFn: async () => {
      const allowedTypes = getAllowedItemTypes();
      
      const { data, error } = await supabase
        .from('production_records')
        .select(`
          serial_number,
          weight_kg,
          length_yards,
          items!inner (
            product_name,
            product_code,
            item_type
          )
        `)
        .in('items.item_type', allowedTypes)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map(record => ({
        serial_number: record.serial_number,
        product_name: (record.items as any)?.product_name || '',
        product_code: (record.items as any)?.product_code || '',
        item_type: (record.items as any)?.item_type || '',
        weight_kg: record.weight_kg,
        length_yards: record.length_yards,
      })) as AvailableSerial[];
    },
    enabled: open,
  });

  // Check if we should show dropdown (for intermediate_type_2) or manual input (for intermediate_type_1)
  const showDropdown = producingItemType === 'intermediate_type_2' || producingItemType === 'finished_good';

  const addEntry = () => {
    setEntries([...entries, { serialNumber: '', weight: undefined, length: undefined, validationStatus: 'pending' }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const validateSerialNumber = async (serialNumber: string, index: number) => {
    if (!serialNumber.trim()) {
      updateEntryValidation(index, 'pending', '');
      return;
    }

    try {
      // Look up the production record to get the item type
      const { data: productionRecord, error } = await supabase
        .from('production_records')
        .select(`
          id,
          serial_number,
          items!inner (
            id,
            product_name,
            product_code,
            item_type
          )
        `)
        .eq('serial_number', serialNumber.trim())
        .maybeSingle();

      if (error) {
        updateEntryValidation(index, 'invalid', 'Error validating serial number');
        return;
      }

      if (!productionRecord) {
        updateEntryValidation(index, 'invalid', 'Serial number not found');
        return;
      }

      const sourceItemType = (productionRecord.items as any)?.item_type;
      const allowedTypes = getAllowedItemTypes();

      // Validate based on what we're producing
      if (!allowedTypes.includes(sourceItemType)) {
        updateEntryValidation(
          index, 
          'invalid', 
          `${getItemTypeLabel(producingItemType || '')} products cannot use ${getItemTypeLabel(sourceItemType)}. Allowed: ${allowedTypes.map(getItemTypeLabel).join(', ')}`
        );
        return;
      }

      // Valid source material
      updateEntryValidation(
        index, 
        'valid', 
        `Valid: ${(productionRecord.items as any)?.product_name} (${getItemTypeLabel(sourceItemType)})`
      );
    } catch (error) {
      console.error('Validation error:', error);
      updateEntryValidation(index, 'invalid', 'Validation failed');
    }
  };

  const getItemTypeLabel = (itemType: string): string => {
    switch (itemType) {
      case 'raw_material':
        return 'Raw Material';
      case 'intermediate_type_1':
        return 'Intermediate Type 1';
      case 'intermediate_type_2':
        return 'Intermediate Type 2';
      case 'finished_good':
        return 'Finished Good';
      default:
        return itemType;
    }
  };

  const updateEntryValidation = (index: number, status: 'pending' | 'valid' | 'invalid', message: string) => {
    const newEntries = [...entries];
    newEntries[index].validationStatus = status;
    newEntries[index].validationMessage = message;
    setEntries(newEntries);
  };

  const updateEntry = (index: number, field: keyof ConsumptionEntry, value: string | number) => {
    const newEntries = [...entries];
    if (field === 'serialNumber') {
      newEntries[index][field] = value as string;
      newEntries[index].validationStatus = 'pending';
      newEntries[index].validationMessage = '';
    } else if (field === 'weight' || field === 'length') {
      newEntries[index][field] = value ? parseFloat(value as string) : undefined;
    }
    setEntries(newEntries);
  };

  const handleSerialSelect = (serial: string, index: number) => {
    updateEntry(index, 'serialNumber', serial);
    // Auto-validate when selecting from dropdown
    const selectedSerial = availableSerials?.find(s => s.serial_number === serial);
    if (selectedSerial) {
      updateEntryValidation(
        index,
        'valid',
        `Valid: ${selectedSerial.product_name} (${getItemTypeLabel(selectedSerial.item_type)})`
      );
    }
  };

  const handleSerialBlur = (index: number) => {
    validateSerialNumber(entries[index].serialNumber, index);
  };

  const handleSubmit = () => {
    // Check all entries are validated
    const hasInvalidEntries = entries.some(entry => entry.validationStatus === 'invalid');
    const hasPendingSerials = entries.some(entry => 
      entry.serialNumber.trim() && entry.validationStatus === 'pending'
    );

    if (hasInvalidEntries) {
      toast({
        title: 'Invalid entries',
        description: 'Please fix the invalid serial numbers before proceeding.',
        variant: 'destructive',
      });
      return;
    }

    if (hasPendingSerials) {
      toast({
        title: 'Validation pending',
        description: 'Please wait for serial number validation to complete.',
        variant: 'destructive',
      });
      return;
    }

    // Validate all entries
    const validEntries = entries.filter(entry => {
      if (!entry.serialNumber.trim()) return false;
      if (entry.validationStatus !== 'valid') return false;
      if (requiresWeight && !entry.weight) return false;
      if (requiresLength && !entry.length) return false;
      return true;
    });

    if (validEntries.length === 0) {
      toast({
        title: 'No valid entries',
        description: 'Please add at least one valid source material.',
        variant: 'destructive',
      });
      return;
    }

    onSubmit(validEntries);
    setEntries([{ serialNumber: '', weight: undefined, length: undefined, validationStatus: 'pending' }]);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setEntries([{ serialNumber: '', weight: undefined, length: undefined, validationStatus: 'pending' }]);
    onOpenChange(false);
  };

  const getSourceMaterialLabel = (): string => {
    if (producingItemType === 'intermediate_type_1') {
      return 'raw materials only';
    }
    if (producingItemType === 'intermediate_type_2') {
      return 'raw materials or Intermediate Type 1 products';
    }
    return 'source materials';
  };

  // Get serials not already selected
  const getAvailableSerialsForEntry = (currentIndex: number): AvailableSerial[] => {
    const selectedSerials = entries
      .filter((_, i) => i !== currentIndex)
      .map(e => e.serialNumber);
    return (availableSerials || []).filter(s => !selectedSerials.includes(s.serial_number));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Raw Material Consumption</DialogTitle>
          <DialogDescription>
            Select {getSourceMaterialLabel()} and enter consumption amounts
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
                  {showDropdown ? (
                    <div className="space-y-1">
                      <Select
                        value={entry.serialNumber}
                        onValueChange={(value) => handleSerialSelect(value, index)}
                      >
                        <SelectTrigger 
                          className={
                            entry.validationStatus === 'invalid' 
                              ? 'border-destructive' 
                              : entry.validationStatus === 'valid' 
                                ? 'border-green-500' 
                                : ''
                          }
                        >
                          <SelectValue placeholder="Select a serial number..." />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
                          {isLoadingSerials ? (
                            <SelectItem value="_loading" disabled>Loading...</SelectItem>
                          ) : getAvailableSerialsForEntry(index).length === 0 ? (
                            <SelectItem value="_empty" disabled>No available serials</SelectItem>
                          ) : (
                            getAvailableSerialsForEntry(index).map((serial) => (
                              <SelectItem 
                                key={serial.serial_number} 
                                value={serial.serial_number}
                                className="cursor-pointer"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{serial.serial_number}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {serial.product_name} ({getItemTypeLabel(serial.item_type)}) - {serial.weight_kg}kg
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {entry.validationMessage && (
                        <p className={`text-xs ${
                          entry.validationStatus === 'invalid' ? 'text-destructive' : 'text-green-600'
                        }`}>
                          {entry.validationMessage}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <Input
                          id={`serial-${index}`}
                          placeholder="e.g., 01-M1-041025-00152-0119"
                          value={entry.serialNumber}
                          onChange={(e) => updateEntry(index, 'serialNumber', e.target.value)}
                          onBlur={() => handleSerialBlur(index)}
                          className={
                            entry.validationStatus === 'invalid' 
                              ? 'border-destructive pr-10' 
                              : entry.validationStatus === 'valid' 
                                ? 'border-green-500 pr-10' 
                                : ''
                          }
                        />
                        {entry.validationStatus === 'valid' && (
                          <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                        )}
                        {entry.validationStatus === 'invalid' && (
                          <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                        )}
                      </div>
                      {entry.validationMessage && (
                        <p className={`text-xs ${
                          entry.validationStatus === 'invalid' ? 'text-destructive' : 'text-green-600'
                        }`}>
                          {entry.validationMessage}
                        </p>
                      )}
                    </div>
                  )}
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
            Add Another Source
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
