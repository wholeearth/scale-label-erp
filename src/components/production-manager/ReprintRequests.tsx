import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Printer, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface ReprintRequest {
  id: string;
  production_record_id: string;
  operator_id: string;
  requested_at: string;
  status: string;
  production_records: {
    serial_number: string;
    barcode_data: string;
    weight_kg: number;
    items: {
      product_name: string;
      product_code: string;
      length_yards: number | null;
      width_inches: number | null;
      color: string | null;
    };
    machines: {
      machine_code: string;
    } | null;
  };
  operator: {
    full_name: string;
    employee_code: string | null;
  };
}

export const ReprintRequests = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

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
    refetchInterval: 5000,
  });

  // Real-time subscription for label config changes
  useEffect(() => {
    const channel = supabase
      .channel('label-config-reprint-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'label_configurations',
        },
        (payload) => {
          console.log('Label design synced:', payload);
          queryClient.invalidateQueries({ queryKey: ['label-configuration'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch pending reprint requests
  const { data: requests, refetch } = useQuery({
    queryKey: ['reprint-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reprint_requests')
        .select(`
          *,
          production_records(
            serial_number,
            barcode_data,
            weight_kg,
            items(product_name, product_code, length_yards, width_inches, color),
            machines(machine_code)
          ),
          operator:profiles!operator_id(full_name, employee_code)
        `)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 5000,
  });

  const printLabel = async (request: ReprintRequest) => {
    const printWindow = window.open('', '', 'width=400,height=300');
    if (!printWindow) return;

    const record = request.production_records;
    const barcodeCanvas = barcodeCanvasRef.current;
    const qrcodeCanvas = document.createElement('canvas');
    const logoUrl = labelConfig?.logo_url || '';
    const companyName = labelConfig?.company_name || 'Company Name';

    // Generate barcode
    if (barcodeCanvas) {
      JsBarcode(barcodeCanvas, record.barcode_data, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: false,
      });
    }

    // Generate QR code
    const QRCode = (await import('qrcode')).default;
    await QRCode.toCanvas(qrcodeCanvas, record.barcode_data, {
      width: 200,
      margin: 1,
    });

    const barcodeDataUrl = barcodeCanvas?.toDataURL() || '';
    const qrcodeDataUrl = qrcodeCanvas?.toDataURL() || '';

    // Get label configuration
    const labelWidth = labelConfig?.label_width_mm || 60;
    const labelHeight = labelConfig?.label_height_mm || 40;
    const fields = (labelConfig?.fields_config as any[]) || [];

    // Field value mapping
    const fieldValues: Record<string, string> = {
      company_name: companyName,
      item_name: record.items.product_name || '-',
      item_code: record.items.product_code || '-',
      length: `${record.items.length_yards || '-'} ${record.items.length_yards ? 'meter' : ''}`,
      width: `${record.items.width_inches || '-'} ${record.items.width_inches ? '"' : ''}`,
      color: record.items.color || '-',
      quality: '-',
      weight: `${record.weight_kg.toFixed(2)} kg`,
      serial_no: record.serial_number,
      barcode: record.barcode_data,
      qrcode: record.barcode_data,
    };

    // Sort fields by zIndex for proper layering
    const sortedFields = [...fields].sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0));

    // Generate field HTML based on type
    const fieldsHtml = sortedFields
      .filter((field: any) => field.enabled !== false && field.visible !== false)
      .map((field: any) => {
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
          transform-origin: top left;
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
              ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : ''}
            </div>
          `;
        } else if (fieldType === 'qrcode' && field.id === 'qrcode') {
          return `
            <div style="${baseStyle} display: flex; align-items: center; justify-content: center;">
              ${qrcodeDataUrl ? `<img src="${qrcodeDataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : ''}
            </div>
          `;
        } else {
          // Text field
          const value = fieldValues[field.id] || field.name || '';
          return `
            <div style="${baseStyle} white-space: nowrap; overflow: hidden;">
              ${value}
            </div>
          `;
        }
      })
      .join('');

    const content = `
      <html>
        <head>
          <title>Production Label</title>
          <style>
            @page {
              size: ${labelWidth}mm ${labelHeight}mm;
              margin: 0;
            }
            body { 
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .label {
              width: ${labelWidth}mm;
              height: ${labelHeight}mm;
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
            ${fieldsHtml}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const approveMutation = useMutation({
    mutationFn: async (requestIds: string[]) => {
      const { error } = await supabase
        .from('reprint_requests')
        .update({
          status: 'approved',
          processed_by: profile?.id,
          processed_at: new Date().toISOString(),
        })
        .in('id', requestIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reprint-requests'] });
      queryClient.invalidateQueries({ queryKey: ['reprint-requests-count'] });
      setSelectedRequests(new Set());
      toast({
        title: 'Success',
        description: 'Reprint requests approved and labels printed',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestIds: string[]) => {
      const { error } = await supabase
        .from('reprint_requests')
        .update({
          status: 'rejected',
          processed_by: profile?.id,
          processed_at: new Date().toISOString(),
        })
        .in('id', requestIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reprint-requests'] });
      queryClient.invalidateQueries({ queryKey: ['reprint-requests-count'] });
      setSelectedRequests(new Set());
      toast({
        title: 'Success',
        description: 'Reprint requests rejected',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handlePrintSelected = async () => {
    if (selectedRequests.size === 0) return;

    const selectedRequestsList = requests?.filter(r => selectedRequests.has(r.id)) || [];
    
    // Print all selected labels
    for (const request of selectedRequestsList) {
      await printLabel(request);
    }

    // Approve all selected requests
    await approveMutation.mutateAsync(Array.from(selectedRequests));
  };

  const handlePrintAll = async () => {
    if (!requests || requests.length === 0) return;

    // Print all labels
    for (const request of requests) {
      await printLabel(request);
    }

    // Approve all requests
    const allRequestIds = requests.map(r => r.id);
    await approveMutation.mutateAsync(allRequestIds);
  };

  const handleRejectSelected = async () => {
    if (selectedRequests.size === 0) return;
    await rejectMutation.mutateAsync(Array.from(selectedRequests));
  };

  const toggleSelectRequest = (requestId: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedRequests.size === requests?.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(requests?.map(r => r.id) || []));
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden canvas for barcode generation */}
      <div className="hidden">
        <canvas ref={barcodeCanvasRef} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reprint Requests</CardTitle>
              <CardDescription>
                Manage label reprint requests from operators
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!requests || requests.length === 0 ? (
            <div className="text-center py-12">
              <Printer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No pending reprint requests</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Checkbox
                  checked={selectedRequests.size === requests.length && requests.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Select All ({selectedRequests.size} selected)
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handlePrintSelected}
                    disabled={selectedRequests.size === 0}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrintAll}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print All
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRejectSelected}
                    disabled={selectedRequests.size === 0}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={selectedRequests.has(request.id)}
                      onCheckedChange={() => toggleSelectRequest(request.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">
                            {request.production_records.items.product_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Code: {request.production_records.items.product_code} | 
                            Serial: {request.production_records.serial_number}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span>Weight: {request.production_records.weight_kg} kg</span>
                        <span>
                          Machine: {request.production_records.machines?.machine_code || 'N/A'}
                        </span>
                        <span>
                          Operator: {request.operator.full_name} 
                          {request.operator.employee_code && ` (${request.operator.employee_code})`}
                        </span>
                        <span>
                          Requested: {new Date(request.requested_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline">Pending</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
