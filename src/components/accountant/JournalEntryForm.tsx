import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface JournalLine {
  account_id: string;
  debit_amount: string;
  credit_amount: string;
}

const JournalEntryForm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [journalNumber, setJournalNumber] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: '', debit_amount: '', credit_amount: '' },
    { account_id: '', debit_amount: '', credit_amount: '' },
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
          description: narration || 'Journal Entry',
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
          description: narration || null,
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
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setNarration('');
    setReferenceNumber('');
    setJournalNumber('');
    setLines([
      { account_id: '', debit_amount: '', credit_amount: '' },
      { account_id: '', debit_amount: '', credit_amount: '' },
    ]);
  };

  const addLine = () => {
    setLines([...lines, { account_id: '', debit_amount: '', credit_amount: '' }]);
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

  const getAccountDisplay = (accountId: string) => {
    const account = accounts?.find(a => a.id === accountId);
    if (!account) return null;
    
    const balanceType = account.current_balance >= 0 ? 'Dr' : 'Cr';
    const balanceAmount = Math.abs(account.current_balance).toFixed(2);
    
    return {
      name: `${account.account_code} ${account.account_name}`,
      balance: `Cur Bal: ${balanceAmount} ${balanceType}`,
    };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar - Tally Style */}
      <div className="bg-[hsl(210,100%,40%)] text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg">Tally GOLD Prime</span>
          <span className="text-sm">Company</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>Accounting Voucher Creation</span>
        </div>
      </div>

      {/* Journal Entry Form */}
      <div className="p-6">
        <form onSubmit={handleSubmit}>
          {/* Top Section - Journal No and Dates */}
          <div className="bg-card border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Journal</span>
                  <span className="text-sm">No.</span>
                  <Input
                    value={journalNumber}
                    onChange={(e) => setJournalNumber(e.target.value)}
                    className="w-32 h-7 text-sm"
                    placeholder="Auto"
                    disabled
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Reference No</span>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-32 h-7 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Monday</span>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-36 h-7 text-sm"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Effective Date</span>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-36 h-7 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div className="border-x border-b border-border">
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-muted border-b border-border">
              <div className="col-span-7 px-4 py-2 text-sm font-semibold border-r border-border">
                Particulars
              </div>
              <div className="col-span-2 px-4 py-2 text-sm font-semibold text-right border-r border-border">
                Debit
              </div>
              <div className="col-span-3 px-4 py-2 text-sm font-semibold text-right">
                Credit
              </div>
            </div>

            {/* Journal Lines */}
            <div className="min-h-[400px]">
              {lines.map((line, index) => {
                const accountDisplay = line.account_id ? getAccountDisplay(line.account_id) : null;
                const isDr = !!line.debit_amount;
                const isCr = !!line.credit_amount;

                return (
                  <div
                    key={index}
                    className={`grid grid-cols-12 border-b border-border hover:bg-accent/50 ${
                      index % 2 === 1 ? 'bg-accent/20' : ''
                    }`}
                  >
                    {/* Particulars Column */}
                    <div className="col-span-7 px-4 py-2 border-r border-border">
                      <div className="flex items-start gap-2">
                        <span className="text-sm font-medium min-w-[20px]">
                          {isDr ? 'Dr' : isCr ? 'Cr' : ''}
                        </span>
                        <div className="flex-1">
                          <Select
                            value={line.account_id}
                            onValueChange={(value) => updateLine(index, 'account_id', value)}
                          >
                            <SelectTrigger className="h-7 text-sm border-0 shadow-none px-0 focus:ring-0">
                              <SelectValue placeholder="Select account..." />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts?.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.account_code} {account.account_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {accountDisplay && (
                            <div className="text-xs italic text-muted-foreground mt-1">
                              {accountDisplay.balance}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Debit Column */}
                    <div className="col-span-2 px-4 py-2 border-r border-border">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit_amount}
                        onChange={(e) => updateLine(index, 'debit_amount', e.target.value)}
                        className="h-7 text-sm text-right border-0 shadow-none focus:ring-0"
                        placeholder=""
                      />
                    </div>

                    {/* Credit Column */}
                    <div className="col-span-3 px-4 py-2 flex items-center justify-between">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit_amount}
                        onChange={(e) => updateLine(index, 'credit_amount', e.target.value)}
                        className="h-7 text-sm text-right border-0 shadow-none focus:ring-0 flex-1"
                        placeholder=""
                      />
                      {lines.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          className="h-6 w-6 ml-2"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Add Line Button Row */}
              <div className="px-4 py-2 border-b border-border">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={addLine}
                  className="text-sm text-primary h-7 px-0"
                >
                  + Add Line
                </Button>
              </div>
            </div>

            {/* Narration */}
            <div className="border-t-2 border-border px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium min-w-[80px]">Narration:</span>
                <Input
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  className="flex-1 h-8 text-sm border-0 shadow-none focus:ring-0"
                  placeholder="Enter narration..."
                />
              </div>
            </div>

            {/* Totals */}
            <div className="border-t-2 border-border bg-muted/50 px-4 py-2 flex justify-end gap-12">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{totals.debit.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{totals.credit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Bottom Action Bar - Tally Style */}
          <div className="mt-4 bg-muted border border-border rounded px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="text-sm h-8"
              >
                <span className="font-semibold">Q:</span>&nbsp;Quit
              </Button>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={!isBalanced || createJournalEntryMutation.isPending}
                className="text-sm h-8"
              >
                <span className="font-semibold">A:</span>&nbsp;
                {createJournalEntryMutation.isPending ? 'Saving...' : 'Accept'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-sm h-8"
              >
                <span className="font-semibold">D:</span>&nbsp;Delete
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="text-sm h-8"
              >
                <span className="font-semibold">X:</span>&nbsp;Cancel Vch
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className={`text-sm ${isBalanced ? 'text-green-600' : 'text-red-600'} font-semibold`}>
                {isBalanced ? '✓ Balanced' : `⚠ Difference: ${Math.abs(totals.debit - totals.credit).toFixed(2)}`}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-sm h-8"
              >
                <span className="font-semibold">F12:</span>&nbsp;Configure
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JournalEntryForm;
