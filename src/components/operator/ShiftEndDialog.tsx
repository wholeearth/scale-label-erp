import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import ShiftDataEntryForm from './ShiftDataEntryForm';

interface ShiftEndDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftRecord: any;
  onShiftEnded: () => void;
}

const ShiftEndDialog = ({ open, onOpenChange, shiftRecord, onShiftEnded }: ShiftEndDialogProps) => {
  const { toast } = useToast();
  const [entryChoice, setEntryChoice] = useState<'yes' | 'no' | null>(null);
  const [showDataEntry, setShowDataEntry] = useState(false);

  const endShiftMutation = useMutation({
    mutationFn: async (status: 'completed' | 'pending') => {
      const { error } = await supabase
        .from('shift_records')
        .update({
          shift_end_time: new Date().toISOString(),
          data_entry_status: status,
        })
        .eq('id', shiftRecord.id);
      
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      toast({
        title: 'Shift ended',
        description: status === 'completed' 
          ? 'Shift data recorded successfully.'
          : 'Shift ended. Data entry can be completed later.',
      });
      onShiftEnded();
      onOpenChange(false);
      setEntryChoice(null);
      setShowDataEntry(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleChoice = (choice: 'yes' | 'no') => {
    setEntryChoice(choice);
    if (choice === 'yes') {
      setShowDataEntry(true);
    } else {
      endShiftMutation.mutate('pending');
    }
  };

  const handleDataEntryComplete = () => {
    endShiftMutation.mutate('completed');
  };

  if (showDataEntry) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enter Shift Data</DialogTitle>
            <DialogDescription>
              Record raw materials consumed and intermediate products produced during this shift
            </DialogDescription>
          </DialogHeader>
          <ShiftDataEntryForm 
            shiftId={shiftRecord.id}
            onComplete={handleDataEntryComplete}
            onCancel={() => {
              setShowDataEntry(false);
              setEntryChoice(null);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End Shift</DialogTitle>
          <DialogDescription>
            Would you like to input raw materials consumed and intermediate products produced now?
          </DialogDescription>
        </DialogHeader>
        
        <RadioGroup value={entryChoice || ''} onValueChange={(value) => handleChoice(value as 'yes' | 'no')}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id="yes" />
            <Label htmlFor="yes" className="cursor-pointer">
              Yes, I'll enter the data now
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id="no" />
            <Label htmlFor="no" className="cursor-pointer">
              No, I'll skip for now (can be entered later by accountant/manager)
            </Label>
          </div>
        </RadioGroup>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShiftEndDialog;
