import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface JournalLine {
  account_id: string;
  description: string;
  debit_amount: string;
  credit_amount: string;
}

const JournalEntryForm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: '', description: '', debit_amount: '', credit_amount: '' },
    { account_id: '', description: '', debit_amount: '', credit_amount: '' },
  ]);

  const { data: accounts } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_code');
      if (error) throw error;
      return data;
    },
  });

  const createJournalEntryMutation = useMutation({
    mutationFn: async () => {
      // Generate entry number
      const { data: entryNumber, error: numberError } = await supabase
        .rpc('generate_journal_entry_number');
      if (numberError) throw numberError;

      const totalDebit = lines.reduce((sum, line) => sum + parseFloat(line.debit_amount || '0'), 0);
      const totalCredit = lines.reduce((sum, line) => sum + parseFloat(line.credit_amount || '0'), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error('Debits and credits must be equal');
      }

      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: entryDate,
          description,
          reference_number: referenceNumber || null,
          total_debit: totalDebit,
          total_credit: totalCredit,
          status: 'draft',
        })
        .select()
        .single();

      if (entryError) throw entryError;

      const journalLines = lines
        .filter(line => line.account_id && (line.debit_amount || line.credit_amount))
        .map(line => ({
          journal_entry_id: entry.id,
          account_id: line.account_id,
          description: line.description || null,
          debit_amount: parseFloat(line.debit_amount || '0'),
          credit_amount: parseFloat(line.credit_amount || '0'),
        }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(journalLines);

      if (linesError) throw linesError;

      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({ title: 'Success', description: 'Journal entry created successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setReferenceNumber('');
    setLines([
      { account_id: '', description: '', debit_amount: '', credit_amount: '' },
      { account_id: '', description: '', debit_amount: '', credit_amount: '' },
    ]);
  };

  const addLine = () => {
    setLines([...lines, { account_id: '', description: '', debit_amount: '', credit_amount: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof JournalLine, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    if (field === 'debit_amount' && value) {
      newLines[index].credit_amount = '';
    } else if (field === 'credit_amount' && value) {
      newLines[index].debit_amount = '';
    }
    
    setLines(newLines);
  };

  const calculateTotals = () => {
    const debit = lines.reduce((sum, line) => sum + parseFloat(line.debit_amount || '0'), 0);
    const credit = lines.reduce((sum, line) => sum + parseFloat(line.credit_amount || '0'), 0);
    return { debit, credit };
  };

  const totals = calculateTotals();
  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      toast({
        title: 'Error',
        description: 'Debits and credits must be equal',
        variant: 'destructive',
      });
      return;
    }
    createJournalEntryMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Journal Entry</CardTitle>
        <CardDescription>Record double-entry accounting transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry-date">Entry Date *</Label>
              <Input
                id="entry-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Optional reference"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this journal entry"
              required
              rows={2}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Journal Entry Lines</h3>
              <Button type="button" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-2" />
                Add Line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg">
                  <div className="col-span-4">
                    <Label className="text-xs">Account</Label>
                    <Select
                      value={line.account_id}
                      onValueChange={(value) => updateLine(index, 'account_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_code} - {account.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      placeholder="Line description"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Debit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debit_amount}
                      onChange={(e) => updateLine(index, 'debit_amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Credit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.credit_amount}
                      onChange={(e) => updateLine(index, 'credit_amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 2}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-8 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Debit</p>
                <p className="text-2xl font-bold">${totals.debit.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Credit</p>
                <p className="text-2xl font-bold">${totals.credit.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Difference</p>
                <p className={`text-2xl font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  ${Math.abs(totals.debit - totals.credit).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm}>
              Clear
            </Button>
            <Button type="submit" disabled={!isBalanced || createJournalEntryMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {createJournalEntryMutation.isPending ? 'Saving...' : 'Save as Draft'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default JournalEntryForm;
