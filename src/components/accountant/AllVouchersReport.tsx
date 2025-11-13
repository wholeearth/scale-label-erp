import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type VoucherType = 'all' | 'purchase' | 'sales_order' | 'sales_return' | 'purchase_return' | 'journal';

export function AllVouchersReport() {
  const [searchTerm, setSearchTerm] = useState('');
  const [voucherType, setVoucherType] = useState<VoucherType>('all');
  const queryClient = useQueryClient();

  const { data: vouchers, isLoading } = useQuery({
    queryKey: ['all-vouchers', voucherType],
    queryFn: async () => {
      let query = supabase
        .from('journal_entries')
        .select('*')
        .order('entry_date', { ascending: false });

      if (voucherType !== 'all') {
        query = query.eq('reference_type', voucherType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-vouchers'] });
      toast.success('Voucher deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredVouchers = vouchers?.filter(
    (voucher) =>
      voucher.entry_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voucher.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getVoucherTypeBadge = (type: string | null) => {
    const labels: Record<string, string> = {
      purchase: 'Purchase',
      sales_order: 'Sales',
      sales_return: 'Sales Return',
      purchase_return: 'Purchase Return',
      journal: 'Journal',
    };
    return <Badge variant="secondary">{labels[type || 'journal'] || 'Journal'}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      draft: 'outline',
      posted: 'default',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Vouchers</CardTitle>
        <CardDescription>View and manage all accounting vouchers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vouchers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={voucherType} onValueChange={(value: VoucherType) => setVoucherType(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="purchase">Purchase</SelectItem>
              <SelectItem value="sales_order">Sales</SelectItem>
              <SelectItem value="sales_return">Sales Return</SelectItem>
              <SelectItem value="purchase_return">Purchase Return</SelectItem>
              <SelectItem value="journal">Journal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredVouchers && filteredVouchers.length > 0 ? (
                filteredVouchers.map((voucher) => (
                  <TableRow key={voucher.id}>
                    <TableCell className="font-medium">{voucher.entry_number}</TableCell>
                    <TableCell>{format(new Date(voucher.entry_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{getVoucherTypeBadge(voucher.reference_type)}</TableCell>
                    <TableCell>{voucher.description}</TableCell>
                    <TableCell className="text-right">{voucher.total_debit.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{voucher.total_credit.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(voucher.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(voucher.id)}
                          disabled={voucher.status === 'posted'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">No vouchers found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
