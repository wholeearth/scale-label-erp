import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Package, Weight, Clock, Barcode, Printer, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

interface Assignment {
  id: string;
  item_id: string;
  quantity_assigned: number;
  quantity_produced: number | null;
  items: {
    id: string;
    product_name: string;
    product_code: string;
    length_yards: number | null;
    width_inches: number | null;
    color: string | null;
  };
}

interface Machine {
  id: string;
  machine_code: string;
  machine_name: string;
}

const ProductionInterface = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<Assignment | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<string>('');
  const [currentWeight, setCurrentWeight] = useState<number>(0);
  const [isCapturingWeight, setIsCapturingWeight] = useState(false);
  const [autoWeight, setAutoWeight] = useState(true);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch assignments
  const { data: assignments } = useQuery({
    queryKey: ['operator-assignments', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from('operator_assignments')
        .select('*, items(*)')
        .eq('operator_id', profile.id)
        .eq('status', 'active');
      if (error) throw error;
      return data as Assignment[];
    },
    enabled: !!profile,
  });

  // Fetch machines
  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('machine_code');
      if (error) throw error;
      return data as Machine[];
    },
  });

  // Auto-capture weight when item is selected
  useEffect(() => {
    if (selectedItem && autoWeight) {
      const interval = setInterval(() => {
        captureWeight();
      }, 2000); // Poll every 2 seconds
      return () => clearInterval(interval);
    }
  }, [selectedItem, autoWeight]);

  // Handle ENTER key press
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedItem && !isCapturingWeight) {
        e.preventDefault();
        handleProduction();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedItem, isCapturingWeight]);

  const captureWeight = async () => {
    if (isCapturingWeight) return;
    
    setIsCapturingWeight(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/read-scale-weight`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to read scale');

      const data = await response.json();
      setCurrentWeight(data.weight);
      
      if (data.mock) {
        console.log('Using mock weight data');
      }
    } catch (error) {
      console.error('Weight capture error:', error);
    } finally {
      setIsCapturingWeight(false);
    }
  };

  const productionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem || !profile || !selectedMachine) {
        throw new Error('Missing required data');
      }

      // Get counters
      const { data: globalCounter, error: globalError } = await supabase
        .from('production_counters')
        .select('global_serial')
        .limit(1)
        .maybeSingle();

      if (globalError) throw globalError;

      const { data: itemCounter, error: itemError } = await supabase
        .from('item_counters')
        .select('item_serial')
        .eq('item_id', selectedItem.item_id)
        .maybeSingle();

      if (itemError) throw itemError;

      const globalSerial = (globalCounter?.global_serial || 0) + 1;
      const itemSerial = (itemCounter?.item_serial || 0) + 1;
      const operatorSequence = (selectedItem.quantity_produced || 0) + 1;

      // Generate serial number: 01-M1-041025-00152-0119
      const now = new Date();
      const operatorCode = profile.employee_code || '00';
      const machineCode = machines?.find(m => m.id === selectedMachine)?.machine_code || 'M1';
      const ddmmyy = now.toLocaleDateString('en-GB').split('/').join('').slice(0, 6); // DDMMYY
      const hhmm = now.toTimeString().slice(0, 5).replace(':', ''); // HHMM
      const opSeq = String(operatorSequence).padStart(5, '0');

      const serialNumber = `${operatorCode}-${machineCode}-${ddmmyy}-${opSeq}-${hhmm}`;

      // Generate barcode data: 00054321:2770:001234:1.25
      const globalSerialStr = String(globalSerial).padStart(8, '0');
      const itemSerialStr = String(itemSerial).padStart(6, '0');
      const barcodeData = `${globalSerialStr}:${selectedItem.items.product_code}:${itemSerialStr}:${currentWeight.toFixed(2)}`;

      // Insert production record
      const { error: insertError } = await supabase
        .from('production_records')
        .insert({
          serial_number: serialNumber,
          barcode_data: barcodeData,
          operator_id: profile.id,
          item_id: selectedItem.item_id,
          machine_id: selectedMachine,
          weight_kg: currentWeight,
          global_serial: globalSerial,
          item_serial: itemSerial,
          operator_sequence: operatorSequence,
          production_date: now.toISOString().split('T')[0],
          production_time: now.toTimeString().slice(0, 8),
        });

      if (insertError) throw insertError;

      // Update counters
      await supabase
        .from('production_counters')
        .update({ global_serial: globalSerial })
        .eq('id', (globalCounter as any)?.id ?? '00000000-0000-0000-0000-000000000000');

      if (!globalCounter) {
        await supabase
          .from('production_counters')
          .insert({ global_serial: globalSerial });
      }

      if (itemCounter) {
        await supabase
          .from('item_counters')
          .update({ item_serial: itemSerial })
          .eq('item_id', selectedItem.item_id);
      } else {
        await supabase
          .from('item_counters')
          .insert({ item_id: selectedItem.item_id, item_serial: itemSerial });
      }

      // Update assignment
      await supabase
        .from('operator_assignments')
        .update({ quantity_produced: operatorSequence })
        .eq('id', selectedItem.id);

      // Add to inventory
      await supabase
        .from('inventory')
        .insert({
          item_id: selectedItem.item_id,
          transaction_type: 'production',
          quantity: 1,
          weight_kg: currentWeight,
        });

      return { serialNumber, barcodeData };
    },
    onSuccess: async ({ serialNumber, barcodeData }) => {
      // Generate and print label
      await generateLabel(serialNumber, barcodeData);
      
      queryClient.invalidateQueries({ queryKey: ['operator-assignments'] });
      
      toast({
        title: 'Success',
        description: `Item ${serialNumber} recorded successfully`,
      });
      
      setCurrentWeight(0);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const generateLabel = async (serialNumber: string, barcodeData: string) => {
    try {
      // Generate 1D Barcode for serial number
      if (barcodeCanvasRef.current) {
        JsBarcode(barcodeCanvasRef.current, serialNumber, {
          format: 'CODE128',
          width: 2,
          height: 100,
          displayValue: true,
        });
      }

      // Generate QR Code for barcode data
      if (qrcodeCanvasRef.current) {
        await QRCode.toCanvas(qrcodeCanvasRef.current, barcodeData, {
          width: 200,
          margin: 1,
        });
      }

      // Print label
      setTimeout(() => {
        printLabel();
      }, 500);
    } catch (error) {
      console.error('Label generation error:', error);
    }
  };

  const printLabel = () => {
    const printWindow = window.open('', '', 'width=400,height=300');
    if (!printWindow) return;

    const barcodeCanvas = barcodeCanvasRef.current;
    const qrcodeCanvas = qrcodeCanvasRef.current;

    const content = `
      <html>
        <head>
          <title>Production Label</title>
          <style>
            @page {
              size: 60mm 40mm;
              margin: 0;
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0;
              padding: 2mm;
              width: 60mm;
              height: 40mm;
              box-sizing: border-box;
            }
            .label {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .header {
              font-size: 8px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 1mm;
            }
            .content {
              display: flex;
              gap: 2mm;
            }
            .left {
              flex: 1;
              font-size: 5px;
              line-height: 1.3;
            }
            .right {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 1mm;
            }
            .barcode img {
              width: 25mm;
              height: auto;
            }
            .qrcode img {
              width: 15mm;
              height: 15mm;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">${selectedItem?.items.product_name}</div>
            <div class="content">
              <div class="left">
                <div>Code: ${selectedItem?.items.product_code}</div>
                <div>Color: ${selectedItem?.items.color || '-'}</div>
                <div>L: ${selectedItem?.items.length_yards || '-'} yds</div>
                <div>W: ${selectedItem?.items.width_inches || '-'} in</div>
                <div>Wt: ${currentWeight.toFixed(2)} kg</div>
                <div>Op: ${profile?.employee_code}</div>
              </div>
              <div class="right">
                <div class="barcode">
                  <img src="${barcodeCanvas?.toDataURL()}" />
                </div>
                <div class="qrcode">
                  <img src="${qrcodeCanvas?.toDataURL()}" />
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  const handleProduction = () => {
    if (currentWeight === 0) {
      toast({
        title: 'Warning',
        description: 'Please wait for weight measurement',
        variant: 'destructive',
      });
      return;
    }
    productionMutation.mutate();
  };

  const handleSelectItem = (assignment: Assignment) => {
    setSelectedItem(assignment);
    setCurrentWeight(0);
  };

  if (!selectedItem) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Item to Produce</CardTitle>
          <CardDescription>Choose from your assigned items to begin production</CardDescription>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No items assigned yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Contact your production manager for assignments
              </p>
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
                      <p className="font-semibold text-lg">{assignment.items.product_name}</p>
                      <p className="text-sm text-muted-foreground">Code: {assignment.items.product_code}</p>
                      <div className="flex gap-4 mt-2 text-sm">
                        {assignment.items.length_yards && (
                          <span className="text-muted-foreground">
                            Length: {assignment.items.length_yards} yds
                          </span>
                        )}
                        {assignment.items.width_inches && (
                          <span className="text-muted-foreground">
                            Width: {assignment.items.width_inches} in
                          </span>
                        )}
                        {assignment.items.color && (
                          <span className="text-muted-foreground">
                            Color: {assignment.items.color}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="default" className="text-lg px-3 py-1">
                        {assignment.quantity_produced || 0} / {assignment.quantity_assigned}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">produced</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hidden canvases for barcode/QR generation */}
      <div className="hidden">
        <canvas ref={barcodeCanvasRef} />
        <canvas ref={qrcodeCanvasRef} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Production Interface</CardTitle>
              <CardDescription>Press ENTER to record and print label</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Change Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Item Info */}
          <div className="p-6 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-2xl">{selectedItem.items.product_name}</h3>
                <p className="text-muted-foreground">Code: {selectedItem.items.product_code}</p>
              </div>
              <Badge variant="default" className="text-2xl px-6 py-3">
                {selectedItem.quantity_produced || 0} / {selectedItem.quantity_assigned}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {selectedItem.items.color && (
                <div>
                  <p className="text-sm text-muted-foreground">Color</p>
                  <p className="font-medium">{selectedItem.items.color}</p>
                </div>
              )}
              {selectedItem.items.length_yards && (
                <div>
                  <p className="text-sm text-muted-foreground">Length</p>
                  <p className="font-medium">{selectedItem.items.length_yards} yards</p>
                </div>
              )}
              {selectedItem.items.width_inches && (
                <div>
                  <p className="text-sm text-muted-foreground">Width</p>
                  <p className="font-medium">{selectedItem.items.width_inches} inches</p>
                </div>
              )}
            </div>
          </div>

          {/* Machine Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Machine</label>
            <Select value={selectedMachine} onValueChange={setSelectedMachine}>
              <SelectTrigger>
                <SelectValue placeholder="Choose machine" />
              </SelectTrigger>
              <SelectContent>
                {machines?.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.machine_code} - {machine.machine_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-2 border-primary">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Weight</p>
                    <p className="text-3xl font-bold text-primary">{currentWeight.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">kg</p>
                  </div>
                  <Weight className="h-10 w-10 text-primary" />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-3"
                  onClick={captureWeight}
                  disabled={isCapturingWeight}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isCapturingWeight ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Produced</p>
                    <p className="text-3xl font-bold text-success">
                      {selectedItem.quantity_produced || 0}
                    </p>
                  </div>
                  <Package className="h-10 w-10 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Remaining</p>
                    <p className="text-3xl font-bold text-warning">
                      {selectedItem.quantity_assigned - (selectedItem.quantity_produced || 0)}
                    </p>
                  </div>
                  <Clock className="h-10 w-10 text-warning" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Button */}
          <Button
            size="lg"
            className="w-full h-16 text-lg"
            onClick={handleProduction}
            disabled={productionMutation.isPending || !selectedMachine || currentWeight === 0}
          >
            {productionMutation.isPending ? (
              <>
                <RefreshCw className="h-6 w-6 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Printer className="h-6 w-6 mr-2" />
                Record & Print Label (Press ENTER)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionInterface;
