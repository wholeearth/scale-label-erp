import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Package, Weight, Clock, Barcode, Printer, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
    use_predefined_weight: boolean | null;
    predefined_weight_kg: number | null;
    expected_weight_kg: number | null;
    weight_tolerance_percentage: number | null;
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
  const [showWeightWarning, setShowWeightWarning] = useState(false);
  const [weightVariance, setWeightVariance] = useState<{ deviation: number; isOver: boolean } | null>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch assignments
  const { data: assignments, refetch: refetchAssignments } = useQuery({
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
    refetchInterval: 5000, // Auto-refetch every 5 seconds for live updates
  });

  // Set up real-time subscription for assignment updates
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('assignment-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'operator_assignments',
          filter: `operator_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('Assignment updated:', payload);
          refetchAssignments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, refetchAssignments]);

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

  // Fetch label configuration
  const { data: labelConfig } = useQuery({
    queryKey: ['label-configuration'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('label_configurations')
        .select('*')
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Auto-capture weight when item is selected (only if not using predefined weight)
  useEffect(() => {
    if (selectedItem) {
      // If item uses predefined weight, set it immediately and disable scale
      if (selectedItem.items.use_predefined_weight && selectedItem.items.predefined_weight_kg) {
        setCurrentWeight(selectedItem.items.predefined_weight_kg);
        setAutoWeight(false);
      } else if (autoWeight) {
        const interval = setInterval(() => {
          captureWeight();
        }, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
      }
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
      checkWeightVariance(data.weight);
      
      if (data.mock) {
        console.log('Using mock weight data');
      }
    } catch (error) {
      console.error('Weight capture error:', error);
    } finally {
      setIsCapturingWeight(false);
    }
  };

  const checkWeightVariance = (weight: number) => {
    if (!selectedItem?.items.expected_weight_kg || !selectedItem?.items.weight_tolerance_percentage) {
      return;
    }

    const expectedWeight = selectedItem.items.expected_weight_kg;
    const tolerance = selectedItem.items.weight_tolerance_percentage;
    const minWeight = expectedWeight * (1 - tolerance / 100);
    const maxWeight = expectedWeight * (1 + tolerance / 100);

    if (weight < minWeight || weight > maxWeight) {
      const deviation = Math.abs(((weight - expectedWeight) / expectedWeight) * 100);
      setWeightVariance({
        deviation: Math.round(deviation * 10) / 10,
        isOver: weight > maxWeight,
      });
      setShowWeightWarning(true);
    } else {
      setWeightVariance(null);
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
      const { data: productionRecord, error: insertError } = await supabase
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
        })
        .select()
        .single();

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
      const { error: inventoryError } = await supabase
        .from('inventory')
        .insert({
          item_id: selectedItem.item_id,
          production_record_id: productionRecord?.id,
          transaction_type: 'production',
          quantity: 1,
          weight_kg: currentWeight,
        });

      if (inventoryError) {
        console.error('Inventory insert error:', inventoryError);
        throw new Error('Failed to update inventory');
      }

      return { serialNumber, barcodeData };
    },
    onSuccess: async ({ serialNumber, barcodeData }) => {
      // Generate and print label
      await generateLabel(serialNumber, barcodeData);
      
      // Invalidate with exact query key including profile ID
      queryClient.invalidateQueries({ queryKey: ['operator-assignments', profile?.id] });
      
      // Force refetch assignments to update the UI immediately
      await refetchAssignments();
      
      // Update selected item state with new produced quantity
      if (selectedItem) {
        const newProducedQty = (selectedItem.quantity_produced || 0) + 1;
        setSelectedItem({
          ...selectedItem,
          quantity_produced: newProducedQty,
        });
      }
      
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
        printLabel(serialNumber, barcodeData);
      }, 500);
    } catch (error) {
      console.error('Label generation error:', error);
    }
  };

  const getFieldValue = (fieldId: string, serialNumber: string, barcodeData: string): string => {
    const fieldValues: Record<string, string> = {
      company_name: labelConfig?.company_name || 'R. K. INTERLINING',
      item_name: selectedItem?.items.product_name || '',
      item_code: selectedItem?.items.product_code || '',
      length: `${selectedItem?.items.length_yards || '-'} yds`,
      width: `${selectedItem?.items.width_inches || '-'}"`,
      color: selectedItem?.items.color || '-',
      quality: '-',
      weight: `${currentWeight.toFixed(2)} kg`,
      serial_no: serialNumber,
      barcode: barcodeData,
      qrcode: barcodeData,
      logo: labelConfig?.logo_url || '',
    };
    return fieldValues[fieldId] || '';
  };

  const printLabel = (serialNumber: string, barcodeData: string) => {
    const printWindow = window.open('', '', 'width=400,height=300');
    if (!printWindow) return;

    const barcodeCanvas = barcodeCanvasRef.current;
    const logoUrl = labelConfig?.logo_url || '';
    const companyName = labelConfig?.company_name || 'Company Name';

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
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              font-size: 11px;
              line-height: 1.3;
            }
            .label {
              width: 60mm;
              height: 40mm;
              padding: 3mm;
              box-sizing: border-box;
              background-color: white;
            }
            .header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;
              padding-bottom: 4px;
              border-bottom: 1px solid #000;
            }
            .logo {
              width: 40px;
              height: 40px;
              object-fit: contain;
            }
            .company-name {
              font-size: 16px;
              font-weight: bold;
            }
            .field {
              margin-bottom: 3px;
            }
            .field-label {
              display: inline-block;
              min-width: 70px;
              font-weight: normal;
            }
            .barcode-section {
              margin-top: 6px;
              text-align: center;
            }
            .barcode-text {
              font-size: 9px;
              margin-top: 2px;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">
              ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : '<div style="width: 40px; height: 40px; background: #e0e0e0; display: flex; align-items: center; justify-content: center; font-size: 10px;">Logo</div>'}
              <div class="company-name">${companyName}</div>
            </div>
            
            <div class="field">
              <span class="field-label">Item Name:</span>
              <span>${selectedItem?.items.product_name || '-'}</span>
            </div>
            
            <div class="field">
              <span class="field-label">Item code:</span>
              <span>${selectedItem?.items.product_code || '-'}</span>
            </div>
            
            <div class="field">
              <span class="field-label">Item weight:</span>
              <span>${currentWeight.toFixed(2)} kg</span>
            </div>
            
            <div class="field">
              <span class="field-label">Length:</span>
              <span>${selectedItem?.items.length_yards || '-'} ${selectedItem?.items.length_yards ? 'meter' : ''}</span>
            </div>
            
            <div class="field">
              <span class="field-label">Width:</span>
              <span>${selectedItem?.items.width_inches || '-'} ${selectedItem?.items.width_inches ? '"' : ''}</span>
            </div>
            
            <div class="field">
              <span class="field-label">Serial no.:</span>
              <span>${serialNumber}</span>
            </div>
            
            <div class="barcode-section">
              <img src="${barcodeCanvas?.toDataURL()}" style="width: 100%; height: auto; max-height: 40px;" />
              <div class="barcode-text">${barcodeData}</div>
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

    // Check weight variance before proceeding
    if (selectedItem?.items.expected_weight_kg && selectedItem?.items.weight_tolerance_percentage) {
      const expectedWeight = selectedItem.items.expected_weight_kg;
      const tolerance = selectedItem.items.weight_tolerance_percentage;
      const minWeight = expectedWeight * (1 - tolerance / 100);
      const maxWeight = expectedWeight * (1 + tolerance / 100);

      if (currentWeight < minWeight || currentWeight > maxWeight) {
        setShowWeightWarning(true);
        return;
      }
    }

    productionMutation.mutate();
  };

  const proceedWithProduction = () => {
    setShowWeightWarning(false);
    productionMutation.mutate();
  };

  const handleSelectItem = (assignment: Assignment) => {
    setSelectedItem(assignment);
    // Reset weight unless item uses predefined weight
    if (assignment.items.use_predefined_weight && assignment.items.predefined_weight_kg) {
      setCurrentWeight(assignment.items.predefined_weight_kg);
    } else {
      setCurrentWeight(0);
    }
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

      {/* Weight Variance Alert Dialog */}
      <AlertDialog open={showWeightWarning} onOpenChange={setShowWeightWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Weight Variance Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                The captured weight <strong>{currentWeight.toFixed(2)} kg</strong> is{' '}
                {weightVariance && (
                  <>
                    <strong>{weightVariance.isOver ? 'above' : 'below'}</strong> the expected range by{' '}
                    <strong>{weightVariance.deviation}%</strong>
                  </>
                )}
              </p>
              {selectedItem?.items.expected_weight_kg && (
                <p className="text-sm">
                  Expected: <strong>{selectedItem.items.expected_weight_kg} kg</strong> (±
                  {selectedItem.items.weight_tolerance_percentage}%)
                </p>
              )}
              <p className="mt-4 font-semibold">
                Do you want to proceed with this weight or re-measure?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => captureWeight()}>
              Re-measure Weight
            </AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithProduction}>
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                    <p className="text-sm text-muted-foreground">
                      Current Weight {selectedItem.items.use_predefined_weight && <span className="text-xs">(Predefined)</span>}
                    </p>
                    <p className="text-3xl font-bold text-primary">{currentWeight.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">kg</p>
                  </div>
                  <Weight className="h-10 w-10 text-primary" />
                </div>
                {!selectedItem.items.use_predefined_weight && (
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
                )}
                {selectedItem.items.use_predefined_weight && (
                  <p className="text-xs text-center mt-3 text-muted-foreground">Scale disabled for this item</p>
                )}
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
