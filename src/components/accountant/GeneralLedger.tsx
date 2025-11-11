import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, CheckCircle, Eye } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  total_debit: number;
  total_credit: number;
  status: string;
  created_at: string;
}

interface JournalEntryLine {
  id: string;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
  chart_of_accounts: {
    account_code: string;
    account_name: string;
  };
}

const GeneralLedger = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [viewDialog, setViewDialog] = useState(false);

  const { data: journalEntries, isLoading } = useQuery({
    queryKey: ['journal-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return data as JournalEntry[];
    },
  });

  const { data: entryLines } = useQuery({
    queryKey: ['journal-entry-lines', selectedEntry?.id],
    queryFn: async () => {
      if (!selectedEntry) return [];
      const { data, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          *,
          chart_of_accounts (
            account_code,
            account_name
          )
        `)
        .eq('journal_entry_id', selectedEntry.id);
      if (error) throw error;
      return data as JournalEntryLine[];
    },
    enabled: !!selectedEntry,
  });

  const postEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('journal_entries')
        .update({ 
          status: 'posted',
          approved_at: new Date().toISOString(),
        })
        .eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-summary'] });
      toast({ title: 'Success', description: 'Journal entry posted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const filteredEntries = journalEntries?.filter(
    (entry) =>
      entry.entry_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      draft: 'secondary',
      posted: 'default',
      void: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };

  const handleView = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setViewDialog(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>General Ledger</CardTitle>
              <CardDescription>View and manage all journal entries</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry #</TableHead>
                <TableHead>Date</TableHead>
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
                  <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredEntries?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">No journal entries found</TableCell>
                </TableRow>
              ) : (
                filteredEntries?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.entry_number}</TableCell>
                    <TableCell>{format(new Date(entry.entry_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ${parseFloat(entry.total_debit.toString()).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${parseFloat(entry.total_credit.toString()).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleView(entry)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {entry.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => postEntryMutation.mutate(entry.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Journal Entry Details</DialogTitle>
            <DialogDescription>
              Entry #{selectedEntry?.entry_number} - {selectedEntry && format(new Date(selectedEntry.entry_date), 'MMMM dd, yyyy')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedEntry.status)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{format(new Date(selectedEntry.created_at), 'MMM dd, yyyy HH:mm')}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedEntry.description}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Entry Lines</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entryLines?.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          {line.chart_of_accounts.account_code} - {line.chart_of_accounts.account_name}
                        </TableCell>
                        <TableCell>{line.description || '-'}</TableCell>
                        <TableCell className="text-right">
                          {line.debit_amount > 0 ? `$${parseFloat(line.debit_amount.toString()).toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {line.credit_amount > 0 ? `$${parseFloat(line.credit_amount.toString()).toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold">
                      <TableCell colSpan={2} className="text-right">Totals:</TableCell>
                      <TableCell className="text-right">${parseFloat(selectedEntry.total_debit.toString()).toFixed(2)}</TableCell>
                      <TableCell className="text-right">${parseFloat(selectedEntry.total_credit.toString()).toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GeneralLedger;
