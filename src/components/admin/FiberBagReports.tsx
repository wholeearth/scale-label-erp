import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, History, Truck } from 'lucide-react';

const statusColor = (s: string) =>
  s === 'available' ? 'default' : s === 'partial' ? 'secondary' : 'outline';

const FiberBagReports = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [historySerial, setHistorySerial] = useState('');

  // ---- Stock report ----
  const { data: bags, isLoading } = useQuery({
    queryKey: ['fiber-bags-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiber_bags')
        .select(`
          id, unique_id, bag_serial, pack_type, original_weight_kg, consumed_weight_kg,
          status, supplier_name, purchase_date, item_id,
          items:items!fiber_bags_item_id_fkey ( product_code, product_name )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const suppliers = useMemo(
    () => Array.from(new Set((bags ?? []).map((b: any) => b.supplier_name))).sort(),
    [bags],
  );

  const filtered = useMemo(() => {
    return (bags ?? []).filter((b: any) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (supplierFilter !== 'all' && b.supplier_name !== supplierFilter) return false;
      if (search) {
        const q = search.toLowerCase().replace(/-/g, '');
        const target = `${b.unique_id} ${b.items?.product_code ?? ''} ${b.items?.product_name ?? ''}`
          .toLowerCase()
          .replace(/-/g, '');
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [bags, statusFilter, supplierFilter, search]);

  // ---- Consumption history ----
  const { data: history } = useQuery({
    queryKey: ['fiber-bag-history', historySerial],
    queryFn: async () => {
      if (!historySerial) return [];
      const norm = historySerial.replace(/-/g, '');
      const { data: bag } = await supabase
        .from('fiber_bags')
        .select('id, unique_id, original_weight_kg, consumed_weight_kg, supplier_name, purchase_date')
        .ilike('unique_id', `%${norm}%`)
        .maybeSingle();
      if (!bag) return [];
      const { data: rows } = await supabase
        .from('fiber_bag_consumption')
        .select(`
          id, consumed_weight_kg, created_at, notes,
          consumer:profiles!fiber_bag_consumption_consumed_by_fkey ( full_name )
        `)
        .eq('fiber_bag_id', bag.id)
        .order('created_at', { ascending: false });
      return [{ bag, rows: rows ?? [] }];
    },
    enabled: !!historySerial,
  });

  // ---- Supplier traceability ----
  const supplierSummary = useMemo(() => {
    const map = new Map<string, { total: number; remaining: number; bags: number }>();
    for (const b of bags ?? []) {
      const cur = map.get(b.supplier_name) ?? { total: 0, remaining: 0, bags: 0 };
      cur.total += Number(b.original_weight_kg) || 0;
      cur.remaining += Math.max(0, (Number(b.original_weight_kg) || 0) - (Number(b.consumed_weight_kg) || 0));
      cur.bags += 1;
      map.set(b.supplier_name, cur);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  }, [bags]);

  return (
    <Tabs defaultValue="stock" className="space-y-4">
      <TabsList>
        <TabsTrigger value="stock"><Package className="h-4 w-4 mr-2" />Bag/Bale Stock</TabsTrigger>
        <TabsTrigger value="history"><History className="h-4 w-4 mr-2" />Consumption History</TabsTrigger>
        <TabsTrigger value="supplier"><Truck className="h-4 w-4 mr-2" />Supplier Traceability</TabsTrigger>
      </TabsList>

      {/* Stock */}
      <TabsContent value="stock">
        <Card>
          <CardHeader>
            <CardTitle>Fiber Bag/Bale Stock</CardTitle>
            <CardDescription>Per-bag inventory with remaining weight</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search serial / product..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unique ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Original (kg)</TableHead>
                  <TableHead className="text-right">Used (kg)</TableHead>
                  <TableHead className="text-right">Remaining (kg)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No bags found</TableCell></TableRow>
                ) : (
                  filtered.map((b: any) => {
                    const remaining = Math.max(0, (Number(b.original_weight_kg) || 0) - (Number(b.consumed_weight_kg) || 0));
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">{b.unique_id}</TableCell>
                        <TableCell>{b.items?.product_code} — {b.items?.product_name}</TableCell>
                        <TableCell className="capitalize">{b.pack_type}</TableCell>
                        <TableCell>{b.supplier_name}</TableCell>
                        <TableCell>{b.purchase_date}</TableCell>
                        <TableCell className="text-right">{Number(b.original_weight_kg).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Number(b.consumed_weight_kg).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">{remaining.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(b.status) as any} className="capitalize">{b.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* History */}
      <TabsContent value="history">
        <Card>
          <CardHeader>
            <CardTitle>Consumption History by Serial</CardTitle>
            <CardDescription>Enter or scan a bag/bale unique ID</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Scan or enter unique ID (hyphens optional)..."
              value={historySerial}
              onChange={(e) => setHistorySerial(e.target.value)}
            />
            {history && history.length > 0 ? (
              history.map((h: any) => (
                <div key={h.bag.id} className="space-y-2">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div><span className="text-muted-foreground">Serial:</span> <span className="font-mono">{h.bag.unique_id}</span></div>
                    <div><span className="text-muted-foreground">Supplier:</span> {h.bag.supplier_name}</div>
                    <div><span className="text-muted-foreground">Purchased:</span> {h.bag.purchase_date}</div>
                    <div><span className="text-muted-foreground">Original:</span> {Number(h.bag.original_weight_kg).toFixed(2)} kg</div>
                    <div><span className="text-muted-foreground">Consumed:</span> {Number(h.bag.consumed_weight_kg).toFixed(2)} kg</div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead className="text-right">Weight (kg)</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {h.rows.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No consumption recorded</TableCell></TableRow>
                      ) : (
                        h.rows.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                            <TableCell>{r.consumer?.full_name ?? '—'}</TableCell>
                            <TableCell className="text-right">{Number(r.consumed_weight_kg).toFixed(2)}</TableCell>
                            <TableCell>{r.notes ?? ''}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              ))
            ) : historySerial ? (
              <p className="text-sm text-muted-foreground">No matching bag found.</p>
            ) : null}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Supplier */}
      <TabsContent value="supplier">
        <Card>
          <CardHeader>
            <CardTitle>Supplier-wise Stock Traceability</CardTitle>
            <CardDescription>Aggregated bag totals per supplier</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Bags/Bales</TableHead>
                  <TableHead className="text-right">Total received (kg)</TableHead>
                  <TableHead className="text-right">Remaining (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierSummary.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No suppliers</TableCell></TableRow>
                ) : (
                  supplierSummary.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right">{s.bags}</TableCell>
                      <TableCell className="text-right">{s.total.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">{s.remaining.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default FiberBagReports;
