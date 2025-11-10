import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Package, Weight, Clock, Barcode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Assignment {
  id: string;
  item_id: string;
  quantity_assigned: number;
  quantity_produced: number;
  item: {
    product_name: string;
    product_code: string;
    length_yards: number;
    width_inches: number;
    color: string;
  };
}

const ProductionInterface = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedItem, setSelectedItem] = useState<Assignment | null>(null);
  const [currentWeight, setCurrentWeight] = useState('0.00');
  const [isProducing, setIsProducing] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, [profile]);

  const fetchAssignments = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('operator_assignments')
        .select(`
          *,
          item:items(*)
        `)
        .eq('operator_id', profile.id)
        .eq('status', 'active');

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const handleSelectItem = (assignment: Assignment) => {
    setSelectedItem(assignment);
    setIsProducing(true);
  };

  const handleProduction = async () => {
    if (!selectedItem || !profile) return;

    try {
      // This would integrate with the scale to get actual weight
      // For now, using a placeholder
      const weight = parseFloat(currentWeight);

      // Generate serial number and barcode
      const now = new Date();
      const operatorCode = profile.employee_code || '00';
      const machineCode = 'M1'; // Would come from selected machine
      const date = now.toISOString().split('T')[0].replace(/-/g, '').slice(2); // DDMMYY
      const time = now.toTimeString().slice(0, 5).replace(':', ''); // HHMM
      const operatorSeq = String(selectedItem.quantity_produced + 1).padStart(5, '0');

      const serialNumber = `${operatorCode}-${machineCode}-${date}-${operatorSeq}-${time}`;
      
      // Would also get global serial and item serial from database
      const barcodeData = `00000001:${selectedItem.item.product_code}:000001:${weight}`;

      const { error } = await supabase
        .from('production_records')
        .insert({
          serial_number: serialNumber,
          barcode_data: barcodeData,
          operator_id: profile.id,
          item_id: selectedItem.item_id,
          weight_kg: weight,
          global_serial: 1,
          item_serial: 1,
          operator_sequence: selectedItem.quantity_produced + 1,
          production_date: now.toISOString().split('T')[0],
          production_time: now.toTimeString().slice(0, 8)
        });

      if (error) throw error;

      // Update assignment
      await supabase
        .from('operator_assignments')
        .update({
          quantity_produced: selectedItem.quantity_produced + 1
        })
        .eq('id', selectedItem.id);

      toast({
        title: 'Success',
        description: `Item ${serialNumber} recorded and label printed`
      });

      // Refresh assignments
      fetchAssignments();
      setCurrentWeight('0.00');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {!selectedItem ? (
        <Card>
          <CardHeader>
            <CardTitle>Select Item to Produce</CardTitle>
            <CardDescription>Choose from your assigned items</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No items assigned yet</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleSelectItem(assignment)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{assignment.item.product_name}</p>
                        <p className="text-sm text-muted-foreground">Code: {assignment.item.product_code}</p>
                        <p className="text-sm text-muted-foreground">
                          {assignment.item.length_yards}yd × {assignment.item.width_inches}" - {assignment.item.color}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">
                          {assignment.quantity_produced} / {assignment.quantity_assigned}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Production Interface</CardTitle>
              <CardDescription>Press ENTER to record production and print label</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-accent/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-lg">{selectedItem.item.product_name}</p>
                    <p className="text-sm text-muted-foreground">Code: {selectedItem.item.product_code}</p>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    {selectedItem.quantity_produced} / {selectedItem.quantity_assigned}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Length</p>
                    <p className="font-medium">{selectedItem.item.length_yards} yards</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Width</p>
                    <p className="font-medium">{selectedItem.item.width_inches} inches</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Color</p>
                    <p className="font-medium">{selectedItem.item.color}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                      <Weight className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Current Weight</p>
                        <p className="text-2xl font-bold">{currentWeight} kg</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                      <Package className="h-5 w-5 text-success" />
                      <div>
                        <p className="text-sm text-muted-foreground">Produced</p>
                        <p className="text-2xl font-bold">{selectedItem.quantity_produced}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-warning" />
                      <div>
                        <p className="text-sm text-muted-foreground">Remaining</p>
                        <p className="text-2xl font-bold">
                          {selectedItem.quantity_assigned - selectedItem.quantity_produced}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-4">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={handleProduction}
                >
                  <Barcode className="h-5 w-5 mr-2" />
                  Record & Print Label (ENTER)
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setSelectedItem(null)}
                >
                  Change Item
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ProductionInterface;
