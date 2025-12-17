import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTraceability } from '@/hooks/useTraceability';
import { TraceabilityViewer } from './TraceabilityViewer';
import { Loader2, QrCode } from 'lucide-react';

interface TraceabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serialNumber: string | null;
}

export const TraceabilityDialog = ({ open, onOpenChange, serialNumber }: TraceabilityDialogProps) => {
  const { data: traceabilityData, isLoading } = useTraceability(serialNumber);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Production Traceability
            {serialNumber && (
              <span className="font-mono text-sm text-muted-foreground ml-2">
                {serialNumber}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TraceabilityViewer 
            node={traceabilityData?.lineage || null} 
            children={traceabilityData?.children}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
