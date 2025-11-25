import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface RawMaterialEntry {
  id: string;
  serialNumber: string;
  weight?: number;
  length?: number;
}

interface IntermediateProductEntry {
  id: string;
  itemId: string;
  quantity: number;
}

interface ShiftDataEntryFormProps {
  shiftId: string;
  operatorId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const ShiftDataEntryForm = ({ shiftId, operatorId, onComplete, onCancel }: ShiftDataEntryFormProps) => {
  const { toast } = useToast();
  const [rawMaterials, setRawMaterials] = useState<RawMaterialEntry[]>([]);
  const [intermediateProducts, setIntermediateProducts] = useState<IntermediateProductEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch intermediate product items
  const { data: items } = useQuery({
    queryKey: ['intermediate-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .in('item_type', ['intermediate_type_1', 'intermediate_type_2'])
        .order('product_name');
      
      if (error) throw error;
      return data;
    },
  });

  const addRawMaterial = () => {
    setRawMaterials([...rawMaterials, { id: crypto.randomUUID(), serialNumber: '' }]);
  };

  const removeRawMaterial = (id: string) => {
    setRawMaterials(rawMaterials.filter(rm => rm.id !== id));
  };

  const updateRawMaterial = (id: string, field: keyof RawMaterialEntry, value: any) => {
    setRawMaterials(rawMaterials.map(rm => 
      rm.id === id ? { ...rm, [field]: value } : rm
    ));
  };

  const addIntermediateProduct = () => {
    setIntermediateProducts([...intermediateProducts, { 
      id: crypto.randomUUID(), 
      itemId: '', 
      quantity: 1 
    }]);
  };

  const removeIntermediateProduct = (id: string) => {
    setIntermediateProducts(intermediateProducts.filter(ip => ip.id !== id));
  };

  const updateIntermediateProduct = (id: string, field: keyof IntermediateProductEntry, value: any) => {
    setIntermediateProducts(intermediateProducts.map(ip => 
      ip.id === id ? { ...ip, [field]: value } : ip
    ));
  };

  const handleSubmit = async () => {
    // Validation
    const invalidRawMaterials = rawMaterials.filter(rm => !rm.serialNumber.trim());
    if (invalidRawMaterials.length > 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter serial numbers for all raw materials',
        variant: 'destructive',
      });
      return;
    }

    const invalidIntermediateProducts = intermediateProducts.filter(ip => !ip.itemId || ip.quantity <= 0);
    if (invalidIntermediateProducts.length > 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select items and enter valid quantities for all intermediate products',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Insert raw material consumption
      if (rawMaterials.length > 0) {
        const { error: rmError } = await supabase
          .from('shift_raw_material_consumption')
          .insert(
            rawMaterials.map(rm => ({
              shift_id: shiftId,
              consumed_serial_number: rm.serialNumber,
              consumed_weight_kg: rm.weight || null,
              consumed_length_yards: rm.length || null,
            }))
          );

        if (rmError) throw rmError;
      }

      // Insert intermediate product production
      if (intermediateProducts.length > 0) {
        const { error: ipError } = await supabase
          .from('shift_intermediate_production')
          .insert(
            intermediateProducts.map(ip => ({
              shift_id: shiftId,
              item_id: ip.itemId,
              quantity_produced: ip.quantity,
            }))
          );

        if (ipError) throw ipError;
      }

      toast({
        title: 'Success',
        description: 'Shift data recorded successfully',
      });
      onComplete();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Raw Materials Consumed</CardTitle>
          <CardDescription>Enter serial numbers and amounts of raw materials used</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rawMaterials.map((rm) => (
            <div key={rm.id} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Label>Serial Number *</Label>
                <Input
                  placeholder="e.g., 01-M1-041025-00152-0119"
                  value={rm.serialNumber}
                  onChange={(e) => updateRawMaterial(rm.id, 'serialNumber', e.target.value)}
                />
              </div>
              <div className="w-32 space-y-2">
                <Label>Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  value={rm.weight || ''}
                  onChange={(e) => updateRawMaterial(rm.id, 'weight', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
              <div className="w-32 space-y-2">
                <Label>Length (yds)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  value={rm.length || ''}
                  onChange={(e) => updateRawMaterial(rm.id, 'length', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-7"
                onClick={() => removeRawMaterial(rm.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addRawMaterial} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Raw Material
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Intermediate Products Produced</CardTitle>
          <CardDescription>Record intermediate products made during this shift</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {intermediateProducts.map((ip) => (
            <div key={ip.id} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Label>Product *</Label>
                <Select
                  value={ip.itemId}
                  onValueChange={(value) => updateIntermediateProduct(ip.id, 'itemId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
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
              <div className="w-32 space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={ip.quantity}
                  onChange={(e) => updateIntermediateProduct(ip.id, 'quantity', parseInt(e.target.value) || 1)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-7"
                onClick={() => removeIntermediateProduct(ip.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addIntermediateProduct} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Intermediate Product
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Complete Shift'}
        </Button>
      </div>
    </div>
  );
};

export default ShiftDataEntryForm;
