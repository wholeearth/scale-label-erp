import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X } from 'lucide-react';

interface FiberBagLabelData {
  id: string;
  unique_id: string;
  bag_serial: number;
  pack_type: string;
  original_weight_kg: number;
  supplier_name: string;
  purchase_date: string;
  items: { product_code: string; product_name: string };
}

interface Props {
  purchaseId: string;
  onClose: () => void;
}

const FiberBagLabels = ({ purchaseId, onClose }: Props) => {
  const [width, setWidth] = useState(80);
  const [height, setHeight] = useState(50);
  const [companyName, setCompanyName] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const { data: bags } = useQuery({
    queryKey: ['fiber-bags-print', purchaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiber_bags')
        .select('id, unique_id, bag_serial, pack_type, original_weight_kg, supplier_name, purchase_date, items(product_code, product_name)')
        .eq('purchase_id', purchaseId)
        .order('bag_serial');
      if (error) throw error;
      return data as unknown as FiberBagLabelData[];
    },
  });

  const { data: config } = useQuery({
    queryKey: ['label-config-fiber'],
    queryFn: async () => {
      const { data } = await supabase.from('label_configurations').select('company_name').limit(1).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (config?.company_name && !companyName) setCompanyName(config.company_name);
  }, [config, companyName]);

  useEffect(() => {
    if (!bags) return;
    bags.forEach((b) => {
      const svg = document.getElementById(`bc-${b.id}`);
      if (svg) {
        try {
          JsBarcode(svg, b.unique_id, {
            format: 'CODE128',
            width: 1.4,
            height: Math.max(20, height * 0.35),
            displayValue: true,
            fontSize: 10,
            margin: 0,
          });
        } catch (e) {
          console.error('Barcode error', e);
        }
      }
    });
  }, [bags, width, height]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !printRef.current) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Fiber Bag Labels</title>
      <style>
        @page { size: ${width}mm ${height}mm; margin: 0; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .label { width: ${width}mm; height: ${height}mm; padding: 2mm; box-sizing: border-box;
                 page-break-after: always; display: flex; flex-direction: column;
                 border: 1px dashed transparent; }
        .label:last-child { page-break-after: auto; }
        .row { display: flex; justify-content: space-between; font-size: 9px; line-height: 1.2; }
        .company { font-size: 11px; font-weight: bold; text-align: center; margin-bottom: 1mm; }
        .supplier { font-size: 9px; text-align: center; margin-bottom: 1mm; }
        .barcode { display: flex; justify-content: center; flex: 1; align-items: center; }
        .barcode svg { max-width: 100%; max-height: 100%; }
        .meta { font-size: 8px; }
        .weight { font-weight: bold; font-size: 11px; }
      </style></head><body>${printRef.current.innerHTML}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  if (!bags) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (bags.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">No fiber bags for this purchase.</p>
        <Button variant="outline" onClick={onClose} className="mt-3">Close</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
        <div className="space-y-1">
          <Label className="text-xs">Width (mm)</Label>
          <Input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value) || 60)} className="w-24 h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Height (mm)</Label>
          <Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value) || 40)} className="w-24 h-8" />
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs">Company Name</Label>
          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-8" />
        </div>
        <Button onClick={handlePrint} className="h-8">
          <Printer className="mr-1 h-4 w-4" /> Print {bags.length} label{bags.length > 1 ? 's' : ''}
        </Button>
        <Button variant="outline" onClick={onClose} className="h-8">
          <X className="mr-1 h-4 w-4" /> Close
        </Button>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-md border bg-background p-4">
        <div ref={printRef} className="flex flex-wrap gap-2">
          {bags.map((b) => (
            <div
              key={b.id}
              className="label"
              style={{
                width: `${width}mm`,
                height: `${height}mm`,
                padding: '2mm',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                border: '1px dashed hsl(var(--border))',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              <div className="company" style={{ fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
                {companyName || 'Company'}
              </div>
              <div className="supplier" style={{ fontSize: 9, textAlign: 'center' }}>
                {b.supplier_name}
              </div>
              <div className="row" style={{ fontSize: 9, display: 'flex', justifyContent: 'space-between' }}>
                <span>{b.items.product_code}</span>
                <span>{new Date(b.purchase_date).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="row" style={{ fontSize: 9, display: 'flex', justifyContent: 'space-between' }}>
                <span>{b.pack_type.toUpperCase()} #{b.bag_serial}</span>
                <span className="weight" style={{ fontWeight: 'bold' }}>{Number(b.original_weight_kg).toFixed(3)} kg</span>
              </div>
              <div
                className="barcode"
                style={{ display: 'flex', justifyContent: 'center', flex: 1, alignItems: 'center' }}
              >
                <svg id={`bc-${b.id}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FiberBagLabels;
