import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, TrendingUp, Warehouse } from "lucide-react";

export function InventoryValuation() {
  const { data: inventoryAccounts, isLoading } = useQuery({
    queryKey: ["inventory-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .in("account_code", ["1300", "1310", "1320"])
        .eq("is_active", true)
        .order("account_code");

      if (error) throw error;
      return data;
    },
  });

  const { data: recentTransactions } = useQuery({
    queryKey: ["inventory-journal-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select(`
          *,
          journal_entry_lines (
            *,
            chart_of_accounts (
              account_code,
              account_name
            )
          )
        `)
        .in("reference_type", ["production_record", "inventory_transaction"])
        .order("entry_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const totalInventoryValue = inventoryAccounts?.reduce(
    (sum, acc) => sum + Number(acc.current_balance || 0),
    0
  ) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalInventoryValue.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finished Goods</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(inventoryAccounts?.find(a => a.account_code === "1300")?.current_balance || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Work in Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(inventoryAccounts?.find(a => a.account_code === "1320")?.current_balance || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Account Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Account Balances</CardTitle>
          <CardDescription>Current balances for all inventory accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Account Type</TableHead>
                <TableHead className="text-right">Current Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryAccounts?.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.account_code}</TableCell>
                  <TableCell>{account.account_name}</TableCell>
                  <TableCell className="capitalize">{account.account_type}</TableCell>
                  <TableCell className="text-right font-semibold">
                    ${Number(account.current_balance || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Inventory Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Inventory Journal Entries</CardTitle>
          <CardDescription>Latest 10 inventory-related journal entries</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.entry_number}</TableCell>
                  <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                  <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                  <TableCell className="capitalize">
                    {entry.reference_type?.replace("_", " ")}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${Number(entry.total_debit || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {(!recentTransactions || recentTransactions.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No inventory transactions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
