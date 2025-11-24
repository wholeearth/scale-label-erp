import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface JumboRollStock {
  serial_number: string;
  item_id: string;
  product_name: string;
  product_code: string;
  original_weight: number;
  consumed_weight: number;
  remaining_weight: number;
  production_date: string;
  operator_name: string;
}

const JumboRollInventory = () => {
  const { data: jumboRolls, isLoading } = useQuery({
    queryKey: ['jumbo-roll-inventory'],
    queryFn: async () => {
      // Get all production records for intermediate products (jumbo rolls)
      const { data: productions, error: prodError } = await supabase
        .from('production_records')
        .select(`
          id,
          serial_number,
          weight_kg,
          production_date,
          item_id,
          items!inner (
            product_name,
            product_code,
            is_intermediate_product
          ),
          profiles!production_records_operator_id_fkey (
            full_name
          )
        `)
        .eq('items.is_intermediate_product', true)
        .order('production_date', { ascending: false });

      if (prodError) throw prodError;

      // Get consumption data for each serial number
      const rollsWithConsumption = await Promise.all(
        (productions || []).map(async (prod: any) => {
          const { data: consumptions } = await supabase
            .from('raw_material_consumption')
            .select('consumed_weight_kg')
            .eq('consumed_serial_number', prod.serial_number);

          const totalConsumed = consumptions?.reduce(
            (sum, c) => sum + (c.consumed_weight_kg || 0),
            0
          ) || 0;

          return {
            serial_number: prod.serial_number,
            item_id: prod.item_id,
            product_name: prod.items?.product_name || 'Unknown',
            product_code: prod.items?.product_code || 'N/A',
            original_weight: prod.weight_kg || 0,
            consumed_weight: totalConsumed,
            remaining_weight: (prod.weight_kg || 0) - totalConsumed,
            production_date: prod.production_date,
            operator_name: prod.profiles?.full_name || 'Unknown',
          } as JumboRollStock;
        })
      );

      return rollsWithConsumption;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const getStockStatus = (remaining: number, original: number) => {
    const percentage = (remaining / original) * 100;
    if (percentage === 0) return { label: 'Consumed', variant: 'outline' as const };
    if (percentage < 25) return { label: 'Low Stock', variant: 'destructive' as const };
    if (percentage < 50) return { label: 'Medium', variant: 'secondary' as const };
    return { label: 'Available', variant: 'default' as const };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Jumbo Roll Inventory
          </CardTitle>
          <CardDescription>Loading jumbo roll stock levels...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Jumbo Roll Inventory
        </CardTitle>
        <CardDescription>
          Track remaining stock levels of intermediate products consumed in production
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!jumboRolls || jumboRolls.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No jumbo rolls in inventory</p>
            <p className="text-sm mt-2">
              Jumbo rolls will appear here once produced
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Original Weight</TableHead>
                  <TableHead className="text-right">Consumed</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Production Date</TableHead>
                  <TableHead>Operator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jumboRolls.map((roll) => {
                  const status = getStockStatus(roll.remaining_weight, roll.original_weight);
                  return (
                    <TableRow key={roll.serial_number}>
                      <TableCell className="font-mono text-sm">
                        {roll.serial_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{roll.product_name}</p>
                          <p className="text-xs text-muted-foreground">{roll.product_code}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {roll.original_weight.toFixed(2)} kg
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-destructive">
                          <TrendingDown className="h-3 w-3" />
                          {roll.consumed_weight.toFixed(2)} kg
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {roll.remaining_weight.toFixed(2)} kg
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(roll.production_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">{roll.operator_name}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JumboRollInventory;