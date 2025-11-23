import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { History, Search, RefreshCw, CheckCircle, XCircle, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface HistoryRequest {
  id: string;
  production_record_id: string;
  operator_id: string;
  requested_at: string;
  status: string;
  processed_at: string | null;
  processed_by: string | null;
  notes: string | null;
  production_records: {
    serial_number: string;
    barcode_data: string;
    weight_kg: number;
    items: {
      product_name: string;
      product_code: string;
    };
    machines: {
      machine_code: string;
    } | null;
  };
  operator: {
    full_name: string;
    employee_code: string | null;
  };
  processor: {
    full_name: string;
    employee_code: string | null;
  } | null;
}

export const ReprintRequestHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Fetch reprint request history
  const { data: requests, refetch, isLoading } = useQuery({
    queryKey: ['reprint-requests-history', statusFilter, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from('reprint_requests')
        .select(`
          *,
          production_records(
            serial_number,
            barcode_data,
            weight_kg,
            items(product_name, product_code),
            machines(machine_code)
          ),
          operator:profiles!operator_id(full_name, employee_code),
          processor:profiles!processed_by(full_name, employee_code)
        `)
        .in('status', ['approved', 'rejected'])
        .order('processed_at', { ascending: false });

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply date filter
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        if (dateFilter === 'today') {
          startDate.setHours(0, 0, 0, 0);
        } else if (dateFilter === 'week') {
          startDate.setDate(now.getDate() - 7);
        } else if (dateFilter === 'month') {
          startDate.setMonth(now.getMonth() - 1);
        }
        
        query = query.gte('processed_at', startDate.toISOString());
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Filter requests by search term
  const filteredRequests = requests?.filter((request) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      request.production_records.items.product_name.toLowerCase().includes(searchLower) ||
      request.production_records.items.product_code.toLowerCase().includes(searchLower) ||
      request.production_records.serial_number.toLowerCase().includes(searchLower) ||
      request.operator.full_name.toLowerCase().includes(searchLower) ||
      request.operator.employee_code?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    if (status === 'approved') {
      return (
        <Badge variant="default" className="bg-success text-success-foreground">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Rejected
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Reprint Request History
              </CardTitle>
              <CardDescription>
                View all processed reprint requests for audit purposes
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by item, serial, or operator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Loading history...</p>
            </div>
          ) : !filteredRequests || filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No reprint requests found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm || statusFilter !== 'all' || dateFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Processed requests will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground mb-4">
                Showing {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
              </div>
              {filteredRequests.map((request) => (
                <Card key={request.id} className="border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Item Info */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">
                              {request.production_records.items.product_name}
                            </h4>
                            {getStatusBadge(request.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Code: {request.production_records.items.product_code} | 
                            Serial: {request.production_records.serial_number}
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Requested By</p>
                            <p className="font-medium">
                              {request.operator.full_name}
                              {request.operator.employee_code && ` (${request.operator.employee_code})`}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Requested At</p>
                            <p className="font-medium">
                              {format(new Date(request.requested_at), 'MMM dd, yyyy')}
                              <span className="text-muted-foreground ml-1">
                                {format(new Date(request.requested_at), 'HH:mm')}
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Processed By</p>
                            <p className="font-medium">
                              {request.processor?.full_name || 'N/A'}
                              {request.processor?.employee_code && ` (${request.processor.employee_code})`}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Processed At</p>
                            <p className="font-medium">
                              {request.processed_at ? (
                                <>
                                  {format(new Date(request.processed_at), 'MMM dd, yyyy')}
                                  <span className="text-muted-foreground ml-1">
                                    {format(new Date(request.processed_at), 'HH:mm')}
                                  </span>
                                </>
                              ) : (
                                'N/A'
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Additional Info */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm pt-2 border-t">
                          <div>
                            <span className="text-muted-foreground">Weight:</span>{' '}
                            <span className="font-medium">{request.production_records.weight_kg} kg</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Machine:</span>{' '}
                            <span className="font-medium">
                              {request.production_records.machines?.machine_code || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Barcode:</span>{' '}
                            <span className="font-mono text-xs">{request.production_records.barcode_data}</span>
                          </div>
                        </div>

                        {/* Notes if rejected */}
                        {request.notes && (
                          <div className="pt-2 border-t">
                            <p className="text-sm text-muted-foreground">Notes:</p>
                            <p className="text-sm mt-1">{request.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
