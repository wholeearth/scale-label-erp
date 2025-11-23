import { useState, useRef } from 'react';
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

  const printLabel = (request: ReprintRequest) => {
    const printWindow = window.open('', '', 'width=400,height=300');
    if (!printWindow) return;

    const record = request.production_records;
    const barcodeCanvas = barcodeCanvasRef.current;
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

    const barcodeDataUrl = barcodeCanvas?.toDataURL() || '';

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
              padding: 4mm;
              font-family: Arial, sans-serif;
              width: 60mm;
              height: 40mm;
              box-sizing: border-box;
            }
            .label-container {
              display: flex;
              flex-direction: column;
              height: 100%;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 2mm;
              padding-bottom: 1mm;
              border-bottom: 1px solid #333;
            }
            .logo {
              width: 12mm;
              height: 12mm;
              object-fit: contain;
            }
            .company-name {
              font-size: 8pt;
              font-weight: bold;
              text-align: center;
              flex: 1;
              margin: 0 2mm;
            }
            .info-section {
              flex: 1;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1mm 2mm;
              font-size: 7pt;
            }
            .info-row {
              display: flex;
              align-items: center;
            }
            .info-label {
              font-weight: bold;
              margin-right: 1mm;
              white-space: nowrap;
            }
            .info-value {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .barcode-section {
              margin-top: auto;
              text-align: center;
              padding-top: 1mm;
            }
            .barcode-image {
              max-width: 100%;
              height: auto;
              max-height: 12mm;
            }
            .barcode-text {
              font-size: 6pt;
              margin-top: 0.5mm;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="header">
              ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : '<div style="width: 12mm;"></div>'}
              <div class="company-name">${companyName}</div>
            </div>
            
            <div class="info-section">
              <div class="info-row">
                <span class="info-label">Item:</span>
                <span class="info-value">${record.items.product_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Code:</span>
                <span class="info-value">${record.items.product_code}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Length:</span>
                <span class="info-value">${record.items.length_yards || '-'} yds</span>
              </div>
              <div class="info-row">
                <span class="info-label">Width:</span>
                <span class="info-value">${record.items.width_inches || '-'}"</span>
              </div>
              <div class="info-row">
                <span class="info-label">Color:</span>
                <span class="info-value">${record.items.color || '-'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Weight:</span>
                <span class="info-value">${record.weight_kg.toFixed(2)} kg</span>
              </div>
            </div>
            
            <div class="barcode-section">
              <img src="${barcodeDataUrl}" class="barcode-image" alt="Barcode" />
              <div class="barcode-text">${record.serial_number}</div>
            </div>
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
    selectedRequestsList.forEach(request => {
      printLabel(request);
    });

    // Approve all selected requests
    await approveMutation.mutateAsync(Array.from(selectedRequests));
  };

  const handlePrintAll = async () => {
    if (!requests || requests.length === 0) return;

    // Print all labels
    requests.forEach(request => {
      printLabel(request);
    });

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
