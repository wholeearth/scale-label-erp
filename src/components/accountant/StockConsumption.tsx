import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingDown } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function StockConsumption() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: consumptionData, isLoading } = useQuery({
    queryKey: ["stock-consumption"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          items (
            product_code,
            product_name
          )
        `)
        .eq("transaction_type", "consumption")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: consumptionJournalEntries } = useQuery({
    queryKey: ["consumption-journal-entries"],
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
        .eq("reference_type", "inventory_transaction")
        .order("entry_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const filteredConsumption = consumptionData?.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.items?.product_code?.toLowerCase().includes(searchLower) ||
      item.items?.product_name?.toLowerCase().includes(searchLower)
    );
  });

  const totalConsumptionValue = consumptionJournalEntries?.reduce(
    (sum, entry) => sum + Number(entry.total_debit || 0),
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
      {/* Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium">Total Raw Material Consumption Value</CardTitle>
            <CardDescription>Based on recorded consumption transactions</CardDescription>
          </div>
          <TrendingDown className="h-8 w-8 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-destructive">
            ${totalConsumptionValue.toFixed(2)}
          </div>
        </CardContent>
      </Card>

      {/* Physical Consumption Records */}
      <Card>
        <CardHeader>
          <CardTitle>Raw Material Consumption Records</CardTitle>
          <CardDescription>Physical consumption tracked in inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search by product code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product Code</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Weight (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConsumption?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {new Date(item.created_at!).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.items?.product_code || "N/A"}
                  </TableCell>
                  <TableCell>{item.items?.product_name || "N/A"}</TableCell>
                  <TableCell className="text-right">
                    {Number(item.quantity).toFixed(0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.weight_kg ? Number(item.weight_kg).toFixed(2) : "N/A"}
                  </TableCell>
                </TableRow>
              ))}
              {(!filteredConsumption || filteredConsumption.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No consumption records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Consumption Journal Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Consumption Journal Entries</CardTitle>
          <CardDescription>Accounting entries for material consumption</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit (WIP)</TableHead>
                <TableHead className="text-right">Credit (RM)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumptionJournalEntries?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.entry_number}</TableCell>
                  <TableCell>
                    {new Date(entry.entry_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                  <TableCell className="text-right text-destructive font-semibold">
                    ${Number(entry.total_debit || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">
                    ${Number(entry.total_credit || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {(!consumptionJournalEntries || consumptionJournalEntries.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No journal entries found
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
