import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ShiftEndDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
  onComplete: (skipDataInput: boolean) => void;
}

interface RawMaterialEntry {
  serialNumber: string;
  weightKg: string;
  lengthYards: string;
}

interface IntermediateProductEntry {
  itemId: string;
  quantity: string;
  weightKg: string;
  lengthYards: string;
}

const ShiftEndDialog = ({ open, onOpenChange, shiftId, onComplete }: ShiftEndDialogProps) => {
  const [step, setStep] = useState<'prompt' | 'input'>('prompt');
  const [rawMaterials, setRawMaterials] = useState<RawMaterialEntry[]>([
    { serialNumber: '', weightKg: '', lengthYards: '' },
  ]);
  const [intermediateProducts, setIntermediateProducts] = useState<IntermediateProductEntry[]>([
    { itemId: '', quantity: '', weightKg: '', lengthYards: '' },
  ]);

  // Fetch intermediate items
  const { data: items } = useQuery({
    queryKey: ['intermediate-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, product_code, product_name')
        .in('item_type', ['intermediate_type_1', 'intermediate_type_2'])
        .order('product_name');

      if (error) throw error;
      return data;
    },
  });

  const handleYes = () => {
    setStep('input');
  };

  const handleNo = async () => {
    await onComplete(true);
  };

  const addRawMaterial = () => {
    setRawMaterials([...rawMaterials, { serialNumber: '', weightKg: '', lengthYards: '' }]);
  };

  const removeRawMaterial = (index: number) => {
    if (rawMaterials.length > 1) {
      setRawMaterials(rawMaterials.filter((_, i) => i !== index));
    }
  };

  const updateRawMaterial = (index: number, field: keyof RawMaterialEntry, value: string) => {
    const updated = [...rawMaterials];
    updated[index][field] = value;
    setRawMaterials(updated);
  };

  const addIntermediateProduct = () => {
    setIntermediateProducts([...intermediateProducts, { itemId: '', quantity: '', weightKg: '', lengthYards: '' }]);
  };

  const removeIntermediateProduct = (index: number) => {
    if (intermediateProducts.length > 1) {
      setIntermediateProducts(intermediateProducts.filter((_, i) => i !== index));
    }
  };

  const updateIntermediateProduct = (index: number, field: keyof IntermediateProductEntry, value: string) => {
    const updated = [...intermediateProducts];
    updated[index][field] = value;
    setIntermediateProducts(updated);
  };

  const handleSubmit = async () => {
    try {
      // Insert raw materials
      const validRawMaterials = rawMaterials.filter(rm => rm.serialNumber.trim());
      if (validRawMaterials.length > 0) {
        const { error: rmError } = await supabase
          .from('shift_raw_material_consumption')
          .insert(
            validRawMaterials.map(rm => ({
              shift_record_id: shiftId,
              consumed_serial_number: rm.serialNumber,
              consumed_weight_kg: rm.weightKg ? parseFloat(rm.weightKg) : null,
              consumed_length_yards: rm.lengthYards ? parseFloat(rm.lengthYards) : null,
            }))
          );

        if (rmError) throw rmError;
      }

      // Insert intermediate products
      const validIntermediateProducts = intermediateProducts.filter(ip => ip.itemId && ip.quantity);
      if (validIntermediateProducts.length > 0) {
        const { error: ipError } = await supabase
          .from('shift_intermediate_production')
          .insert(
            validIntermediateProducts.map(ip => ({
              shift_record_id: shiftId,
              item_id: ip.itemId,
              quantity_produced: parseInt(ip.quantity),
              total_weight_kg: ip.weightKg ? parseFloat(ip.weightKg) : null,
              total_length_yards: ip.lengthYards ? parseFloat(ip.lengthYards) : null,
            }))
          );

        if (ipError) throw ipError;
      }

      await onComplete(false);
    } catch (error: any) {
      toast.error('Failed to save shift data: ' + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>End Shift</DialogTitle>
          <DialogDescription>
            {step === 'prompt' 
              ? 'Would you like to input raw materials and intermediate products now?'
              : 'Enter raw materials consumed and intermediate products produced during this shift'}
          </DialogDescription>
        </DialogHeader>

        {step === 'prompt' ? (
          <div className="flex gap-4 justify-center pt-4">
            <Button onClick={handleYes} size="lg" className="min-w-[120px]">
              Yes, Input Now
            </Button>
            <Button onClick={handleNo} variant="outline" size="lg" className="min-w-[120px]">
              No, Input Later
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Raw Materials Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Raw Materials Consumed</h3>
                <Button type="button" variant="outline" size="sm" onClick={addRawMaterial}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Material
                </Button>
              </div>
              {rawMaterials.map((material, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Material {index + 1}</Label>
                      {rawMaterials.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRawMaterial(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Serial Number *</Label>
                        <Input
                          placeholder="e.g., 01-M1-041025-00152-0119"
                          value={material.serialNumber}
                          onChange={(e) => updateRawMaterial(index, 'serialNumber', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Weight (kg)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 15.5"
                          value={material.weightKg}
                          onChange={(e) => updateRawMaterial(index, 'weightKg', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Length (yards)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 100"
                          value={material.lengthYards}
                          onChange={(e) => updateRawMaterial(index, 'lengthYards', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Intermediate Products Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Intermediate Products Produced</h3>
                <Button type="button" variant="outline" size="sm" onClick={addIntermediateProduct}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>
              {intermediateProducts.map((product, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Product {index + 1}</Label>
                      {intermediateProducts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIntermediateProduct(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <Label>Item *</Label>
                        <Select
                          value={product.itemId}
                          onValueChange={(value) => updateIntermediateProduct(index, 'itemId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items?.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.product_code} - {item.product_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          placeholder="e.g., 50"
                          value={product.quantity}
                          onChange={(e) => updateIntermediateProduct(index, 'quantity', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Total Weight (kg)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 150.5"
                          value={product.weightKg}
                          onChange={(e) => updateIntermediateProduct(index, 'weightKg', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Total Length (yards)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 500"
                          value={product.lengthYards}
                          onChange={(e) => updateIntermediateProduct(index, 'lengthYards', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit}>
                Submit & End Shift
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShiftEndDialog;
