import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Banknote, Plus, Check } from "lucide-react";

export function CashReceipts() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: receipts, isLoading } = useQuery({
    queryKey: ["cash-receipts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_receipts")
        .select(`
          *,
          customers (
            customer_name,
            contact_email
          ),
          orders (
            order_number
          )
        `)
        .order("receipt_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-for-receipts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_name")
        .order("customer_name");

      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["orders-for-receipts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_id")
        .eq("status", "completed")
        .order("order_number");

      if (error) throw error;
      return data;
    },
  });

  const createReceiptMutation = useMutation({
    mutationFn: async (receiptData: any) => {
      const { data: receiptNumber } = await supabase.rpc("generate_receipt_number");

      const { data, error } = await supabase
        .from("cash_receipts")
        .insert({
          receipt_number: receiptNumber,
          ...receiptData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] });
      toast.success("Receipt created successfully");
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to create receipt: " + error.message);
    },
  });

  const postReceiptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cash_receipts")
        .update({ status: "posted" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] });
      toast.success("Receipt posted successfully");
    },
    onError: (error) => {
      toast.error("Failed to post receipt: " + error.message);
    },
  });

  const handleCreateReceipt = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    createReceiptMutation.mutate({
      customer_id: formData.get("customer_id"),
      order_id: formData.get("order_id") || null,
      amount: parseFloat(formData.get("amount") as string),
      payment_method: formData.get("payment_method"),
      reference_number: formData.get("reference_number") || null,
      notes: formData.get("notes") || null,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      posted: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const totalReceived = receipts
    ?.filter((r) => r.status === "posted")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0;

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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Cash Receipts Management</CardTitle>
            <CardDescription>Record customer payments and reduce accounts receivable</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Received</p>
              <p className="text-2xl font-bold text-green-600">${totalReceived.toFixed(2)}</p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Receipt
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Receipt Records</CardTitle>
          <CardDescription>All customer payment receipts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts?.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-medium">{receipt.receipt_number}</TableCell>
                  <TableCell>
                    {new Date(receipt.receipt_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{receipt.customers?.customer_name}</TableCell>
                  <TableCell>{receipt.orders?.order_number || "N/A"}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    ${Number(receipt.amount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="capitalize">
                    {receipt.payment_method?.replace("_", " ")}
                  </TableCell>
                  <TableCell>{receipt.reference_number || "—"}</TableCell>
                  <TableCell>{getStatusBadge(receipt.status)}</TableCell>
                  <TableCell>
                    {receipt.status === "pending" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => postReceiptMutation.mutate(receipt.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Post
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!receipts || receipts.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No receipts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Receipt Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleCreateReceipt}>
            <DialogHeader>
              <DialogTitle>Record Cash Receipt</DialogTitle>
              <DialogDescription>Record a payment received from a customer</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="customer_id">Customer *</Label>
                <Select name="customer_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.customer_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="order_id">Order (Optional)</Label>
                <Select name="order_id">
                  <SelectTrigger>
                    <SelectValue placeholder="Select order (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {orders?.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.order_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="payment_method">Payment Method *</Label>
                  <Select name="payment_method" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reference_number">Reference Number</Label>
                <Input
                  id="reference_number"
                  name="reference_number"
                  placeholder="Check #, Transaction ID, etc."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createReceiptMutation.isPending}>
                {createReceiptMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Receipt
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
