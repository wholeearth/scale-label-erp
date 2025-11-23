import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Package, Weight, Clock, Barcode, Printer, RefreshCw, AlertTriangle, History, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';
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

  // Fetch label configuration with real-time sync
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
    refetchInterval: 5000, // Poll every 5 seconds for updates
  });

  // Real-time subscription for label config changes
  useEffect(() => {
    const channel = supabase
      .channel('label-config-operator-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'label_configurations',
        },
        (payload) => {
          console.log('Label design synced from admin:', payload);
          queryClient.invalidateQueries({ queryKey: ['label-configuration'] });
          toast({ 
            title: 'Label design updated', 
            description: 'New label configuration received from admin',
            duration: 3000 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);

  // Fetch production history
  const { data: productionHistory } = useQuery({
    queryKey: ['production-history', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from('production_records')
        .select('*, items(product_name, product_code), machines(machine_code)')
        .eq('operator_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
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

  // Handle ENTER and R key press
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedItem && !isCapturingWeight) {
        e.preventDefault();
        handleProduction();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRequestLastReprint();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedItem, isCapturingWeight, productionHistory]);

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
      setTimeout(async () => {
        await printLabel(serialNumber, barcodeData);
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

  const printLabel = async (serialNumber: string, barcodeData: string, itemData?: any, weight?: number) => {
    const printWindow = window.open('', '', 'width=400,height=300');
    if (!printWindow) return;

    const barcodeCanvas = barcodeCanvasRef.current;
    const qrcodeCanvas = qrcodeCanvasRef.current;
    const logoUrl = labelConfig?.logo_url || '';
    const companyName = labelConfig?.company_name || 'Company Name';
    
    // Use provided data or fall back to current selection
    const item = itemData || selectedItem?.items;
    const itemWeight = weight !== undefined ? weight : currentWeight;

    // Get label configuration - convert mm to px for consistency with preview
    const labelWidthMm = labelConfig?.label_width_mm || 60;
    const labelHeightMm = labelConfig?.label_height_mm || 40;
    const labelWidth = labelWidthMm * 3.78; // Convert mm to px
    const labelHeight = labelHeightMm * 3.78;
    const fields = (labelConfig?.fields_config as any[]) || [];

    // Field value mapping
    const fieldValues: Record<string, string> = {
      company_name: companyName,
      item_name: item?.product_name || '-',
      item_code: item?.product_code || '-',
      length: `${item?.length_yards || '-'} ${item?.length_yards ? 'meter' : ''}`,
      width: `${item?.width_inches || '-'} ${item?.width_inches ? '"' : ''}`,
      color: item?.color || '-',
      quality: '-',
      weight: `${itemWeight.toFixed(2)} kg`,
      serial_no: serialNumber,
      barcode: barcodeData,
      qrcode: barcodeData,
    };

    // Sort fields by zIndex for proper layering
    const sortedFields = [...fields].sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0));

    // Generate field HTML based on type
    const fieldsHtml = await Promise.all(
      sortedFields
        .filter((field: any) => field.enabled !== false && field.visible !== false)
        .map(async (field: any) => {
          const fieldType = field.type || 'text';
          const rotation = field.rotation || 0;
          const fontSize = field.fontSize || 12;
          const fontFamily = field.fontFamily || 'Arial';
          const fontWeight = field.fontWeight || 'normal';
          const color = field.color || '#000000';
          const backgroundColor = field.backgroundColor || 'transparent';
          const textAlign = field.textAlign || 'left';
          const borderWidth = field.borderWidth || 0;
          const borderColor = field.borderColor || '#000000';
          const borderRadius = field.borderRadius || 0;
          const padding = field.padding || 0;
          const opacity = field.opacity !== undefined ? field.opacity : 1;
          const width = field.width || 'auto';
          const height = field.height || 'auto';
          const zIndex = field.zIndex || 0;

          const baseStyle = `
            position: absolute;
            left: ${field.x || 0}px;
            top: ${field.y || 0}px;
            transform: rotate(${rotation}deg);
            transform-origin: center;
            font-size: ${fontSize}px;
            font-family: ${fontFamily};
            font-weight: ${fontWeight};
            color: ${color};
            background-color: ${backgroundColor};
            text-align: ${textAlign};
            border: ${borderWidth}px solid ${borderColor};
            border-radius: ${borderRadius}px;
            padding: ${padding}px;
            opacity: ${opacity};
            width: ${typeof width === 'number' ? `${width}px` : width};
            height: ${typeof height === 'number' ? `${height}px` : height};
            z-index: ${zIndex};
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: ${textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start'};
          `;

          // Handle different field types
          if (fieldType === 'logo') {
            return `
              <div style="${baseStyle}">
                ${logoUrl ? `<img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: contain;" alt="Logo" />` : ''}
              </div>
            `;
          } else if (fieldType === 'barcode' && field.id === 'barcode') {
            return `
              <div style="${baseStyle} display: flex; flex-direction: column; align-items: center;">
                ${barcodeCanvas ? `<img src="${barcodeCanvas.toDataURL()}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : ''}
              </div>
            `;
          } else if (fieldType === 'qrcode' && field.id === 'qrcode') {
            return `
              <div style="${baseStyle} display: flex; align-items: center; justify-content: center;">
                ${qrcodeCanvas ? `<img src="${qrcodeCanvas.toDataURL()}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : ''}
              </div>
            `;
          } else {
            // Text field
            const value = fieldValues[field.id] || field.name || '';
            return `
              <div style="${baseStyle}">
                <span style="white-space: pre-wrap; word-break: break-word;">${value}</span>
              </div>
            `;
          }
        })
    );

    const content = `
      <html>
        <head>
          <title>Production Label</title>
          <style>
            @page {
              size: ${labelWidthMm}mm ${labelHeightMm}mm;
              margin: 0;
            }
            body { 
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .label {
              width: ${labelWidth}px;
              height: ${labelHeight}px;
              position: relative;
              background-color: ${(labelConfig as any)?.backgroundColor || 'white'};
              border: ${(labelConfig as any)?.borderWidth || 0}px solid ${(labelConfig as any)?.borderColor || '#000000'};
              border-radius: ${(labelConfig as any)?.borderRadius || 0}px;
              overflow: hidden;
            }
          </style>
        </head>
        <body>
          <div class="label">
            ${(await Promise.all(fieldsHtml)).join('')}
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

  const requestReprintMutation = useMutation({
    mutationFn: async (productionRecordId: string) => {
      if (!profile) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('reprint_requests')
        .insert({
          production_record_id: productionRecordId,
          operator_id: profile.id,
          status: 'pending',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Request Sent',
        description: 'Reprint request sent to production manager',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Request Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleRequestReprint = (record: any) => {
    requestReprintMutation.mutate(record.id);
  };

  const handleRequestLastReprint = () => {
    if (!productionHistory || productionHistory.length === 0) {
      toast({
        title: 'No Records',
        description: 'No production history available',
        variant: 'destructive',
      });
      return;
    }

    const lastRecord = productionHistory[0];
    requestReprintMutation.mutate(lastRecord.id);
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

      {/* Live Label Preview */}
      {labelConfig && selectedMachine && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Live Label Preview
            </CardTitle>
            <CardDescription>See how your label will print with current production data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center min-h-[300px]">
              <div
                className="relative bg-white shadow-2xl"
                style={{
                  width: (labelConfig.label_width_mm || 60) * 3.78,
                  height: (labelConfig.label_height_mm || 40) * 3.78,
                  transform: 'scale(1)',
                  transformOrigin: 'center',
                  border: `${(labelConfig as any).borderWidth || 0}px solid ${(labelConfig as any).borderColor || 'transparent'}`,
                  borderRadius: (labelConfig as any).borderRadius || 0,
                  backgroundColor: (labelConfig as any).backgroundColor || '#ffffff',
                }}
              >
                {((labelConfig.fields_config as any[]) || [])
                  .filter((field: any) => field.visible !== false && field.enabled !== false)
                  .sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0))
                  .map((field: any) => {
                      const now = new Date();
                      const operatorCode = profile?.employee_code || '00';
                      const machineCode = machines?.find(m => m.id === selectedMachine)?.machine_code || 'M1';
                      const ddmmyy = now.toLocaleDateString('en-GB').split('/').join('').slice(0, 6);
                      const hhmm = now.toTimeString().slice(0, 5).replace(':', '');
                      const operatorSeq = String((selectedItem.quantity_produced || 0) + 1).padStart(5, '0');
                      const previewSerial = `${operatorCode}-${machineCode}-${ddmmyy}-${operatorSeq}-${hhmm}`;
                      const previewBarcode = `00012345:${selectedItem.items.product_code}:000123:${currentWeight.toFixed(2)}`;

                      const fieldValues: Record<string, string> = {
                        company_name: labelConfig.company_name || 'Company',
                        item_name: selectedItem.items.product_name,
                        item_code: selectedItem.items.product_code,
                        length: `${selectedItem.items.length_yards || '-'} yds`,
                        width: `${selectedItem.items.width_inches || '-'}"`,
                        color: selectedItem.items.color || '-',
                        quality: '-',
                        weight: `${currentWeight.toFixed(2)} kg`,
                        serial_no: previewSerial,
                        barcode: previewBarcode,
                        qrcode: previewBarcode,
                        logo: labelConfig.logo_url || '',
                      };

                      const value = fieldValues[field.id] || field.label || '';

                    return (
                      <div
                        key={field.id}
                        className="absolute"
                        style={{
                          left: field.x,
                          top: field.y,
                          width: field.width,
                          height: field.height,
                          transform: `rotate(${field.rotation}deg)`,
                          transformOrigin: 'center',
                          opacity: field.opacity,
                        }}
                      >
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            fontSize: field.fontSize,
                            fontWeight: field.fontWeight,
                            fontFamily: field.fontFamily,
                            color: field.color,
                            backgroundColor: field.backgroundColor,
                            textAlign: field.textAlign,
                            border: `${field.borderWidth}px solid ${field.borderColor}`,
                            borderRadius: field.borderRadius,
                            padding: field.padding,
                          }}
                        >
                          {field.type === 'text' && (
                            <span className="truncate w-full" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {value}
                            </span>
                          )}
                          {field.type === 'logo' && fieldValues.logo && (
                            <img src={fieldValues.logo} alt="Logo" className="w-full h-full object-contain" />
                          )}
                          {field.type === 'barcode' && (
                            <canvas
                              ref={(el) => {
                                if (el && value && value.trim()) {
                                  try {
                                    JsBarcode(el, value, {
                                      format: 'CODE128',
                                      width: 1.5,
                                      height: field.height - 10 || 40,
                                      displayValue: false,
                                      margin: 0,
                                    });
                                  } catch (error) {
                                    console.error('Barcode generation error:', error);
                                  }
                                }
                              }}
                              style={{ maxWidth: '100%', maxHeight: '100%' }}
                            />
                          )}
                          {field.type === 'qrcode' && (
                            <QRCodeSVG
                              value={value}
                              size={Math.min(field.width || 100, field.height || 100) - 8}
                              level="M"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Production Interface</CardTitle>
              <CardDescription>Press ENTER to record and print label | Press R to request reprint of last label</CardDescription>
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

      {/* Production History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <CardTitle>Production History</CardTitle>
          </div>
          <CardDescription>Recent production records (last 20 items)</CardDescription>
        </CardHeader>
        <CardContent>
          {!productionHistory || productionHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No production records yet</p>
          ) : (
            <div className="space-y-2">
              {productionHistory.map((record: any) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{record.items?.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Code: {record.items?.product_code} | Serial: {record.serial_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                      <span>Weight: {record.weight_kg} kg</span>
                      <span>Machine: {record.machines?.machine_code || 'N/A'}</span>
                      <span>
                        Date: {new Date(record.production_date).toLocaleDateString()} {record.production_time}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRequestReprint(record)}
                    className="ml-4"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Request Reprint
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionInterface;
